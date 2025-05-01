import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogOut, BarChart3, User, Award, Star, Trophy, Medal, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ProfilePage = () => {
  const { currentUser, logout, getUserDailyScans, getUserTotalScans, getUserBarcodesScanned, barcodes } = useDB();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  React.useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);
  
  // Set up auto-refresh of stats every 10 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, []);

  if (!currentUser) {
    return null;
  }

  // Use refreshKey to trigger re-evaluation of these values
  const dailyScans = getUserDailyScans();
  const totalScans = refreshKey >= 0 ? getUserTotalScans() : 0; // Using refreshKey to force re-evaluation
  const recentBarcodes = getUserBarcodesScanned().slice(0, 5);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const achievements = [
    {
      icon: Trophy,
      title: "Speed Scanner",
      description: "Scan 600 panels in under 60 minutes",
      count: dailyScans,
      target: 600,
    },
    {
      icon: Star,
      title: "Pattern Finder",
      description: "Find barcodes with 4 consecutive identical digits",
      count: 0,
    },
    {
      icon: Medal,
      title: "Straight Spotter",
      description: "Find barcodes with a 5-digit straight sequence",
      count: 0,
    },
  ];

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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Your Statistics
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh stats">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Daily Scans</span>
                <span className="font-medium">{dailyScans}</span>
              </div>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="mr-2 h-5 w-5" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {achievements.map((achievement, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <achievement.icon className={`h-5 w-5 ${achievement.count >= (achievement.target || 1) ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{achievement.title}</span>
                      <span>{achievement.count} found</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{achievement.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {currentUser?.role === 'manager' && (
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
