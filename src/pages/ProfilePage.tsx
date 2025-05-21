import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogOut, BarChart3, User, Award, Star, Trophy, Medal, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {useUserStats} from "@/hooks/use-user-stats.tsx";

const ProfilePage = () => {
  const { currentUser, logout } = useDB();
  const navigate = useNavigate();

  const {data: userStats} = useUserStats();

  const currentUserStats = userStats?.find(user => user.username === currentUser?.username);

  React.useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);


  if (!currentUser) {
    return null;
  }


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const achievements = [
    {
      icon: Trophy,
      title: "Speed Scanner",
      description: "Scan 590 panels in under 60 minutes",
      count: 0,
      target: 590,
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Daily Scans</span>
                <span className="font-medium">{currentUserStats?.dailyScans}</span>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between items-center">
                <span>Total Scans</span>
                <span className="text-xl font-bold">{currentUserStats?.totalScans || 0}</span>
              </div>
            </div>
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
