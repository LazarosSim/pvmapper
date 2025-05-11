import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { 
  BarChart3, 
  Users, 
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CalendarIcon,
  Loader2
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const DashboardPage = () => {
  const { 
    currentUser, 
    parks, 
    rows,
    getAllUserStats, 
    getParkProgress, 
    getDailyScans, 
    getScansForDateRange, 
    barcodes 
  } = useDB();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dailyScanStats, setDailyScanStats] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarData, setCalendarData] = useState<{[key: string]: number}>({});
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  // Redirect if not authenticated or not a manager
  React.useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (currentUser.role !== 'manager') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // Load user statistics
  useEffect(() => {
    if (currentUser?.role === 'manager') {
      const stats = getAllUserStats();
      setUserStats(stats);
    }
  }, [currentUser, getAllUserStats]);

  // Load calendar data when month changes
  useEffect(() => {
    const loadCalendarData = async () => {
      if (!selectedDate || currentUser?.role !== 'manager') return;
      
      setIsLoadingCalendar(true);
      
      try {
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        
        const scans = await getScansForDateRange(start, end);
        
        // Convert to format needed by calendar
        const dataByDate: {[key: string]: number} = {};
        scans.forEach(item => {
          dataByDate[item.date] = item.count;
        });
        
        setCalendarData(dataByDate);
        
        // Also generate monthly trend data
        const trend = generateMonthlyTrend(start, dataByDate);
        setMonthlyData(trend);
      } catch (error) {
        console.error("Error loading calendar data:", error);
      } finally {
        setIsLoadingCalendar(false);
      }
    };
    
    loadCalendarData();
  }, [selectedDate, currentUser, getScansForDateRange]);

  // Load daily scan data when a date is selected
  useEffect(() => {
    const loadDailyStats = async () => {
      if (!selectedDate || currentUser?.role !== 'manager') return;
      
      setIsLoadingStats(true);
      
      try {
        const stats = await getDailyScans(selectedDate);
        setDailyScanStats(stats);
      } catch (error) {
        console.error("Error loading daily stats:", error);
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    loadDailyStats();
  }, [selectedDate, currentUser, getDailyScans]);

  if (!currentUser || currentUser.role !== 'manager') {
    return null;
  }

  // Generate daily trend data for the selected month
  const generateMonthlyTrend = (monthStart: Date, data: {[key: string]: number}) => {
    const result = [];
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      const dateStr = format(date, 'yyyy-MM-dd');
      result.push({
        date: format(date, 'MMM dd'),
        scans: data[dateStr] || 0
      });
    }
    
    return result;
  };

  // Calculate total scans (sum of all barcodes from all users)
  const totalScans = barcodes.length;
  
  // Calculate today's scans
  const totalDailyScans = userStats.reduce((total, user) => total + user.dailyScans, 0);
  const prevDayScans = userStats.reduce((total, user) => total + (user.prevDayScans || 0), 0);
  const scanChange = totalDailyScans > 0 && prevDayScans > 0 
    ? ((totalDailyScans - prevDayScans) / prevDayScans) * 100 
    : 0;

  // Park completion percentages for the overview
  const parkProgress = parks.map(park => ({
    ...park,
    ...getParkProgress(park.id)
  }));

  // Sort parks by completion percentage
  const sortedParks = [...parkProgress].sort((a, b) => b.percentage - a.percentage);

  // Calendar day render function
  const renderDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const scanCount = calendarData[dateStr] || 0;
    let intensity = "";
    
    if (scanCount > 60) intensity = "bg-green-500";
    else if (scanCount > 40) intensity = "bg-green-400";
    else if (scanCount > 20) intensity = "bg-green-300";
    else if (scanCount > 0) intensity = "bg-green-200";
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative h-9 w-9 p-0">
              <div className={`absolute inset-1 rounded-sm ${scanCount ? intensity : ""}`}></div>
              <div className="relative z-10 flex h-full w-full items-center justify-center">
                {format(day, "d")}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{scanCount} scans on {format(day, "MMM d")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };
  
  // Sum daily scan stats by user
  const getDailyScanTotal = () => {
    return dailyScanStats.reduce((sum, stat) => sum + stat.count, 0);
  };

  return (
    <Layout title="Manager Dashboard" showBack>
      <div className="space-y-6">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalScans}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Today's Scans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalDailyScans}
                    {scanChange > 0 ? (
                      <ArrowUpRight className="inline-block ml-1 text-green-500 h-4 w-4" />
                    ) : scanChange < 0 ? (
                      <ArrowDownRight className="inline-block ml-1 text-red-500 h-4 w-4" />
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {scanChange !== 0 ? 
                      `${scanChange > 0 ? '+' : ''}${Math.abs(scanChange).toFixed(1)}% vs previous day` : 
                      'No comparison data available'}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Layers className="mr-2 h-5 w-5" />
                  Park Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sortedParks.length > 0 ? (
                  sortedParks.map(park => (
                    <div key={park.id} className="space-y-2">
                      <div className="flex justify-between">
                        <span>{park.name}</span>
                        <span className="font-medium">{park.percentage}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{park.completed} scanned</span>
                        <span>{park.total} expected</span>
                      </div>
                      <Progress 
                        value={park.percentage} 
                        className={`h-2 ${park.percentage >= 100 ? 'bg-green-200' : ''}`}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-2">No parks found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="users" className="space-y-4 pt-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  User Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userStats.length > 0 ? (
                  <div className="space-y-4">
                    {userStats.map(user => (
                      <div key={user.userId} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{user.username}</span>
                          <span>{user.totalScans} total scans</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Today: {user.dailyScans} scans</span>
                          <span>{user.daysActive} days active | Avg: {user.averageScansPerDay}/day</span>
                        </div>
                        <Progress 
                          value={Math.min(100, (user.dailyScans / 50) * 100)} 
                          className="h-2" 
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-2">No users found</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  User Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      width={500}
                      height={300}
                      data={userStats}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="username" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalScans" name="Total Scans" fill="#8884d8" />
                      <Bar dataKey="dailyScans" name="Today's Scans" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="calendar" className="space-y-4 pt-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarIcon className="mr-2 h-5 w-5" />
                  Daily Scan Overview
                </CardTitle>
                <CardDescription>
                  Select a date to see detailed scan information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingCalendar ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center p-2">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="border rounded-md pointer-events-auto"
                        components={{
                          Day: ({ date, ...props }) => renderDay(date)
                        }}
                      />
                    </div>
                    
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-4">Monthly Scan Trends</h4>
                      <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            width={500}
                            height={200}
                            data={monthlyData}
                            margin={{
                              top: 10,
                              right: 30,
                              left: 0,
                              bottom: 0,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="scans" stroke="#8884d8" fill="#8884d8" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
                
                {selectedDate && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">
                      Scan details for {format(selectedDate, 'MMM d, yyyy')}
                    </h4>
                    
                    {isLoadingStats ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : dailyScanStats.length > 0 ? (
                      <>
                        <div className="text-2xl font-bold mb-4">
                          {getDailyScanTotal()} total scans
                        </div>
                        
                        <h5 className="text-sm font-medium mb-2">Breakdown by User</h5>
                        <div className="space-y-2">
                          {dailyScanStats.map((stat, index) => (
                            <div key={index} className="flex justify-between items-center">
                              <span>{stat.username || `User ${stat.userId.slice(0, 6)}`}</span>
                              <div className="flex items-center">
                                <span className="font-medium">{stat.count} scans</span>
                                <div 
                                  className="ml-2 h-3 bg-blue-500 rounded"
                                  style={{ width: `${Math.max(8, stat.count / 2)}px` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground py-2">No scan data found for this date</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default DashboardPage;
