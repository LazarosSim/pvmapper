import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import Layout from '@/components/layout/layout';
import {supabase} from '@/integrations/supabase/client';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Progress} from '@/components/ui/progress';
import {Calendar} from '@/components/ui/calendar';
import {ArrowDownRight, ArrowUpRight, BarChart3, CalendarIcon, Check, Layers, Loader2, UserPlus, Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {endOfMonth, format, isSameMonth, parseISO, startOfMonth, subDays} from 'date-fns';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,} from "@/components/ui/tooltip";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from 'recharts';
import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {DayContentProps} from 'react-day-picker';
import {ParkProgress} from "@/components/parks/ParkProgress.tsx";
import {useParkStats} from "@/hooks/parks";
import {useUserStats} from "@/hooks/use-user-stats.tsx";
import {useCurrentUser} from "@/hooks/use-user.tsx";
import {useApproveUser, usePendingUsers} from "@/hooks/use-pending-users";

// Today's date in Greece as 'yyyy-MM-dd', the same calendar the daily_user_scans view uses
const greekToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(new Date());

// Percentage of part in whole; null when there is nothing to compare against
const percentOf = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

// Scans per Greek date in a range ('yyyy-MM-dd' -> count), counting the barcodes that currently exist
const getScansForDateRange = async (startDay: string, endDay: string): Promise<{[date: string]: number}> => {
  const { data, error } = await supabase
    .from('daily_user_scans')
    .select('day, scans')
    .gte('day', startDay)
    .lte('day', endDay);
  if (error) throw error;
  const countByDate: {[date: string]: number} = {};
  for (const row of data ?? []) {
    if (!row.day) continue;
    countByDate[row.day] = (countByDate[row.day] ?? 0) + Number(row.scans ?? 0);
  }
  return countByDate;
};

// Per-user scans on one Greek date, biggest first
const getUserScansForDay = async (day: string): Promise<{username: string, scans: number}[]> => {
  const { data, error } = await supabase
    .from('daily_user_scans')
    .select('username, scans')
    .eq('day', day);
  if (error) throw error;
  return (data ?? [])
    .map(row => ({ username: row.username ?? 'Unknown', scans: Number(row.scans ?? 0) }))
    .filter(row => row.scans > 0)
    .sort((a, b) => b.scans - a.scans);
};

const useDailyUserScans = (day: string | undefined, enabled: boolean) => useQuery({
  queryKey: ['server', 'daily-user-scans', day],
  queryFn: () => getUserScansForDay(day!),
  enabled: enabled && !!day,
});

// Daily trend data for one month
const generateMonthlyTrend = (monthStart: Date, data: {[key: string]: number}) => {
  const result: {date: string, scans: number}[] = [];
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

const DashboardPage = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('overview');
  // "Today" is the Greek date; as a local Date it is midnight of that calendar day
  const todayStr = greekToday();
  const today = parseISO(todayStr);
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(today);
  const [displayMonth, setDisplayMonth] = useState<Date>(startOfMonth(today));

  const {data: parks} = useParkStats();
  const {data: userStats} = useUserStats();
  const {data: currentUser} = useCurrentUser();
  const {data: pendingUsers} = usePendingUsers(currentUser?.role === 'manager');
  const {mutate: approveUser, isPending: isApproving, variables: approvingUserId} = useApproveUser();
  const isManager = currentUser?.role === 'manager';

  // Scans per day for the month the calendar shows
  const monthKey = format(displayMonth, 'yyyy-MM');
  const {data: calendarData = {}, isLoading: isLoadingCalendar} = useQuery({
    queryKey: ['server', 'daily-scans-range', monthKey],
    queryFn: () => getScansForDateRange(
      format(startOfMonth(displayMonth), 'yyyy-MM-dd'),
      format(endOfMonth(displayMonth), 'yyyy-MM-dd'),
    ),
    enabled: isManager,
    placeholderData: keepPreviousData,
  });
  const monthlyData = generateMonthlyTrend(startOfMonth(displayMonth), calendarData);

  // Per-user scans for the selected day, today and yesterday (Greek dates)
  const selectedDay = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined;
  const {data: selectedDayScans, isLoading: isLoadingStats} = useDailyUserScans(selectedDay, isManager);
  const {data: todayScans} = useDailyUserScans(todayStr, isManager);
  const {data: yesterdayScans} = useDailyUserScans(yesterdayStr, isManager);

  // Redirect if not authenticated or not a manager
  React.useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (currentUser.role !== 'manager') {
      navigate('/');
    }
  }, [currentUser, navigate]);


  if (!currentUser || currentUser.role !== 'manager') {
    return null;
  }

  // Calculate total scans (sum of scans for all parks)
  const totalScans = parks?.map(park => park.currentBarcodes).reduce((a, b) => a + b, 0) ?? 0;

  // Today's scans per user (Greek today, from user_stats) and their sum
  const totalDailyScans = userStats?.map(user => Number(user.dailyScans ?? 0)).reduce((a, b) => a + b, 0) ?? 0;

  // Today's vs yesterday's scans (both Greek dates, from daily_user_scans)
  const sumScans = (rows?: {scans: number}[]) => rows?.reduce((a, row) => a + row.scans, 0) ?? 0;
  const todayTotal = todayScans ? sumScans(todayScans) : totalDailyScans;
  const yesterdayTotal = sumScans(yesterdayScans);
  // null when there is nothing to compare with (no data yet, or no scans yesterday)
  const scanChange = yesterdayScans && yesterdayTotal > 0
    ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
    : null;

  const selectedDayTotal = sumScans(selectedDayScans);

  const handleSelectDate = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && !isSameMonth(date, displayMonth)) setDisplayMonth(startOfMonth(date));
  };


  // Calendar day contents (rendered inside the day button, so clicking still selects it)
  const renderDay = (day: Date, isSelected: boolean) => {
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
              <div className={`absolute inset-1 rounded-sm ${scanCount && !isSelected ? intensity : ""}`}></div>
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
                    {todayTotal}
                    {scanChange !== null && scanChange > 0 ? (
                      <ArrowUpRight className="inline-block ml-1 text-green-500 h-4 w-4" />
                    ) : scanChange !== null && scanChange < 0 ? (
                      <ArrowDownRight className="inline-block ml-1 text-red-500 h-4 w-4" />
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {scanChange !== null ?
                      `${scanChange > 0 ? '+' : scanChange < 0 ? '-' : ''}${Math.abs(scanChange).toFixed(1)}% vs previous day` :
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
                {parks?.map((park, index) => (
                    <ParkProgress key={index} name={park.name}
                                  expected={park.expectedBarcodes}
                                  current={park.currentBarcodes}
                                  percentage={percentOf(park.currentBarcodes, park.expectedBarcodes)} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="users" className="space-y-4 pt-2">
            {pendingUsers && pendingUsers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <UserPlus className="mr-2 h-5 w-5" />
                    Waiting for approval
                  </CardTitle>
                  <CardDescription>
                    These accounts can't see or change any data until you approve them.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-xs text-muted-foreground">
                          Signed up {format(new Date(user.createdAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={isApproving && approvingUserId === user.id}
                        onClick={() => approveUser(user.id, {
                          onSuccess: () => toast.success(`${user.username} approved`),
                          onError: (error) => toast.error(`Could not approve ${user.username}: ${error.message}`),
                        })}
                      >
                        {isApproving && approvingUserId === user.id
                          ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          : <Check className="mr-1 h-4 w-4" />}
                        Approve
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  User Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userStats && userStats.length > 0 ? (
                  <div className="space-y-4">
                    {userStats.map(user => (
                      <div key={user.username} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{user.username}</span>
                          <span>{user.totalScans} total scans</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Today: {user.dailyScans} scans</span>
                          <span>{user.daysActive} days active | Avg: {user.averageDailyScans}/day</span>
                        </div>
                        <Progress 
                          value={Math.min(100, percentOf(Number(user.dailyScans ?? 0), totalDailyScans) ?? 0)}
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
                      <ChartTooltip />
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
                        onSelect={handleSelectDate}
                        month={displayMonth}
                        onMonthChange={setDisplayMonth}
                        today={today}
                        className="border rounded-md pointer-events-auto"
                        components={{
                          DayContent: ({ date, activeModifiers }: DayContentProps) =>
                            renderDay(date, !!activeModifiers.selected)
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
                            <ChartTooltip />
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
                    ) : selectedDayScans && selectedDayScans.length > 0 ? (
                      <>
                        <div className="text-2xl font-bold mb-4">
                          {selectedDayTotal} total scans
                        </div>
                        
                        <h5 className="text-sm font-medium mb-2">Breakdown by User</h5>
                        <div className="space-y-2">
                          {selectedDayScans.map(user => (
                            <div key={user.username} className="flex justify-between items-center">
                              <span>{user.username}</span>
                              <div className="flex items-center">
                                <span className="font-medium">{user.scans} scans</span>
                                <div 
                                  className="ml-2 h-3 bg-blue-500 rounded"
                                  style={{ width: `${Math.max(8, Math.min(100, percentOf(user.scans, selectedDayTotal) ?? 0))}px` }}
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
