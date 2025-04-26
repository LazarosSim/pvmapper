
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogOut, BarChart3, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Progress } from '@/components/ui/progress';

const ProfilePage = () => {
  const { currentUser, logout, getUserDailyScans, getUserTotalScans, getUserBarcodesScanned } = useDB();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  if (!currentUser) {
    return null;
  }

  const dailyScans = getUserDailyScans();
  const totalScans = getUserTotalScans();
  const recentBarcodes = getUserBarcodesScanned().slice(0, 5);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const dailyGoal = 100; // Example daily goal
  const dailyProgress = Math.min(100, Math.round((dailyScans / dailyGoal) * 100));

  return (
    <Layout title="Profile">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              {currentUser.username}
            </CardTitle>
            <CardDescription>
              {currentUser.role === 'manager' ? 'Manager' : 'Scanner'} · 
              Joined {formatDistanceToNow(new Date(currentUser.createdAt), { addSuffix: true })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Your Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Daily Scans</span>
                <span className="font-medium">{dailyScans} / {dailyGoal}</span>
              </div>
              <Progress value={dailyProgress} className="h-2" />
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between items-center">
                <span>Total Scans</span>
                <span className="text-xl font-bold">{totalScans}</span>
              </div>
            </div>
            
            {recentBarcodes.length > 0 && (
              <div className="pt-4 space-y-2">
                <h3 className="text-sm font-medium">Recent Scans</h3>
                <div className="space-y-1">
                  {recentBarcodes.map(barcode => (
                    <div key={barcode.id} className="text-sm text-muted-foreground flex justify-between">
                      <span>{barcode.code}</span>
                      <span>{formatDistanceToNow(new Date(barcode.timestamp), { addSuffix: true })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {currentUser.role === 'manager' && (
          <Button 
            className="w-full"
            onClick={() => navigate('/dashboard')}
          >
            View Manager Dashboard
          </Button>
        )}
      </div>
    </Layout>
  );
};

export default ProfilePage;
