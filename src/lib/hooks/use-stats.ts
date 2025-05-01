import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { DailyScanStat, UserStat, Barcode } from '../types/db-types';

export const useStats = () => {
  const [dailyScans, setDailyScans] = useState<DailyScanStat[]>([]);

  // Fetch daily scans data
  const fetchDailyScans = async (userId?: string) => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('daily_scans')
        .select('*')
        .order('date', { ascending: false });
        
      if (error) {
        console.error('Error fetching daily scans:', error);
        return;
      }
      
      if (data) {
        // Get all user profiles to map IDs to usernames
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username');
          
        const usernameMap = profiles ? 
          profiles.reduce((map: {[key: string]: string}, profile) => {
            map[profile.id] = profile.username;
            return map;
          }, {}) : {};
          
        const formattedScans: DailyScanStat[] = data.map(scan => ({
          date: scan.date,
          count: scan.count,
          userId: scan.user_id,
          username: usernameMap[scan.user_id] || 'Unknown'
        }));
        
        setDailyScans(formattedScans);
      }
    } catch (error: any) {
      console.error('Error in fetchDailyScans:', error.message);
    }
  };
  
  // Update daily scans
  const updateDailyScans = async (userId?: string) => {
    if (!userId) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Check if entry exists for today
      const { data, error } = await supabase
        .from('daily_scans')
        .select()
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking daily scans:', error);
        return;
      }
      
      if (data) {
        // Update existing entry
        await supabase
          .from('daily_scans')
          .update({ count: data.count + 1 })
          .eq('id', data.id);
          
        // Update local data
        setDailyScans(prev => prev.map(scan => 
          scan.userId === userId && scan.date === today 
            ? { ...scan, count: scan.count + 1 } 
            : scan
        ));
      } else {
        // Create new entry
        const { data: newScan } = await supabase
          .from('daily_scans')
          .insert([{ 
            user_id: userId,
            count: 1,
            date: today
          }])
          .select();
          
        // Update local data
        if (newScan && newScan[0]) {
          setDailyScans(prev => [
            ...prev, 
            { 
              date: today, 
              count: 1, 
              userId: userId,
              username: 'Current User'
            }
          ]);
        }
      }
    } catch (error: any) {
      console.error('Error updating daily scans:', error.message);
    }
  };

  // Function to decrease daily scan count when barcodes are deleted
  const decreaseDailyScans = async (userId?: string, date?: string, count: number = 1) => {
    if (!userId || !date) return;
    
    try {
      // Check if entry exists for this date
      const { data, error } = await supabase
        .from('daily_scans')
        .select()
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking daily scans:', error);
        return;
      }
      
      if (data) {
        // Update existing entry - allow it to go negative for accurate tracking
        const newCount = data.count - count;
        
        await supabase
          .from('daily_scans')
          .update({ count: newCount })
          .eq('id', data.id);
          
        // Update local data
        setDailyScans(prev => prev.map(scan => 
          scan.userId === userId && scan.date === date
            ? { ...scan, count: newCount } 
            : scan
        ));
      }
    } catch (error: any) {
      console.error('Error decreasing daily scans:', error.message);
    }
  };

  const getUserDailyScans = (userId?: string): number => {
    if (!userId) return 0;
    const today = new Date().toISOString().split('T')[0];
    const todayScan = dailyScans.find(scan => scan.userId === userId && scan.date === today);
    return todayScan?.count || 0;
  };

  // Enhanced to ensure it accurately counts all barcodes for a user
  const getUserTotalScans = (userId: string, barcodes: Barcode[]): number => {
    if (!userId) return 0;
    // Count all barcodes in the array that belong to this user
    return barcodes.filter(barcode => barcode.userId === userId).length;
  };
  
  // Get user's scanned barcodes
  const getUserBarcodesScanned = (userId: string, barcodes: Barcode[]): Barcode[] => {
    if (!userId) return [];
    return barcodes
      .filter(barcode => barcode.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };
  
  const getAllUserStats = (
    barcodes: Barcode[], 
    users: { id: string; username: string }[], 
    currentUserId?: string,
    currentUsername?: string
  ): UserStat[] => {
    // Collect unique users from barcodes and daily scans
    const userIdsFromBarcodes = [...new Set(barcodes.map(b => b.userId))];
    const userIdsFromScans = [...new Set(dailyScans.map(ds => ds.userId))];
    const allUserIds = [...new Set([...userIdsFromBarcodes, ...userIdsFromScans])];
    
    // Create a map of usernames
    const usernameMap: {[key: string]: string} = {};
    
    // Add usernames from users array
    users.forEach(user => {
      usernameMap[user.id] = user.username;
    });
    
    // Add usernames from dailyScans
    dailyScans.forEach(scan => {
      if (scan.username && scan.userId) {
        usernameMap[scan.userId] = scan.username;
      }
    });
    
    // If currentUser exists and isn't in the map, add it
    if (currentUserId && currentUsername && !usernameMap[currentUserId]) {
      usernameMap[currentUserId] = currentUsername;
    }
    
    return allUserIds.map(userId => {
      const userScans = barcodes.filter(barcode => barcode.userId === userId);
      const userDailyScans = dailyScans.filter(scan => scan.userId === userId);
      
      // Calculate daily scans for today
      const today = new Date().toISOString().split('T')[0];
      const todayScan = userDailyScans.find(scan => scan.date === today);
      const dailyScanCount = todayScan?.count || 0;
      
      // Calculate days active
      const activeDays = new Set(userDailyScans.map(scan => scan.date)).size;
      
      // Calculate average scans per day
      const averageScans = activeDays > 0 
        ? userDailyScans.reduce((sum, scan) => sum + scan.count, 0) / activeDays 
        : 0;
      
      return {
        userId,
        username: usernameMap[userId] || `User-${userId.slice(0, 6)}`,
        totalScans: userScans.length,
        dailyScans: dailyScanCount,
        daysActive: activeDays,
        averageScansPerDay: Math.round(averageScans * 10) / 10
      };
    });
  };
  
  // Get scans for a specific date
  const getDailyScans = async (date?: Date): Promise<DailyScanStat[]> => {
    const targetDate = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    
    // First try to find data in our local state
    const localDailyScans = dailyScans.filter(scan => scan.date === targetDate);
    
    if (localDailyScans.length > 0) {
      return localDailyScans;
    }
    
    // If not found locally, query the database
    try {
      const { data, error } = await supabase
        .from('daily_scans')
        .select()
        .eq('date', targetDate);
        
      if (error) {
        console.error(`Error fetching daily scans for ${targetDate}:`, error);
        return [];
      }
      
      if (data && data.length > 0) {
        // Get usernames for these users
        const userIds = data.map(scan => scan.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
          
        const usernameMap = profiles ? 
          profiles.reduce((map: {[key: string]: string}, profile) => {
            map[profile.id] = profile.username;
            return map;
          }, {}) : {};
          
        return data.map(scan => ({
          date: scan.date,
          count: scan.count,
          userId: scan.user_id,
          username: usernameMap[scan.user_id] || 'Unknown'
        }));
      }
      
      return [];
    } catch (error: any) {
      console.error(`Error in getDailyScans for ${targetDate}:`, error.message);
      return [];
    }
  };
  
  // Get scans for a date range
  const getScansForDateRange = async (startDate: Date, endDate: Date): Promise<{date: string, count: number}[]> => {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    
    try {
      const { data, error } = await supabase
        .from('daily_scans')
        .select('date, count')
        .gte('date', start)
        .lte('date', end);
        
      if (error) {
        console.error(`Error fetching scans for range ${start} to ${end}:`, error);
        return [];
      }
      
      if (data) {
        // Aggregate counts by date
        const countByDate: {[date: string]: number} = {};
        
        data.forEach(scan => {
          if (!countByDate[scan.date]) {
            countByDate[scan.date] = 0;
          }
          countByDate[scan.date] += scan.count;
        });
        
        // Convert to array for returning
        return Object.entries(countByDate).map(([date, count]) => ({ date, count }));
      }
      
      return [];
    } catch (error: any) {
      console.error(`Error in getScansForDateRange for ${start} to ${end}:`, error.message);
      return [];
    }
  };

  return {
    dailyScans,
    setDailyScans,
    fetchDailyScans,
    updateDailyScans,
    decreaseDailyScans,
    getUserDailyScans,
    getUserTotalScans,
    getUserBarcodesScanned,
    getAllUserStats,
    getDailyScans,
    getScansForDateRange
  };
};
