
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Users, 
  Layers,
  ArrowUpRight,
  ArrowDownRight 
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const DashboardPage = () => {
  const { currentUser, parks, getAllUserStats, getParkProgress } = useDB();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('overview');

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

  const userStats = getAllUserStats();
  const totalScans = userStats.reduce((total, user) => total + user.totalScans, 0);
  const totalDailyScans = userStats.reduce((total, user) => total + user.dailyScans, 0);

  // Park completion percentages for the overview
  const parkProgress = parks.map(park => ({
    ...park,
    ...getParkProgress(park.id)
  }));

  // Sort parks by completion percentage
  const sortedParks = [...parkProgress].sort((a, b) => b.percentage - a.percentage);

  return (
    <Layout title="Manager Dashboard" showBack>
      <div className="space-y-6">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
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
                    {totalDailyScans > 0 ? (
                      <ArrowUpRight className="inline-block ml-1 text-green-500 h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="inline-block ml-1 text-red-500 h-4 w-4" />
                    )}
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
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default DashboardPage;
