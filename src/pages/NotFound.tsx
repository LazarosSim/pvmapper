
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <Layout title="Not Found">
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-6">Oops! Page not found</p>
        <Button onClick={() => navigate('/')}>
          Return to Home
        </Button>
      </div>
    </Layout>
  );
};

export default NotFound;
