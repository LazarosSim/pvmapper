import { useState, useCallback, useEffect } from 'react';

const ARCHIVED_SETTING_KEY = 'pvmapper:show-archived';

export const useAppSettings = () => {
    const [showArchived, setShowArchived] = useState<boolean>(() => {
        try {
            return localStorage.getItem(ARCHIVED_SETTING_KEY) === 'true';
        } catch {
            return false;
        }
    });

    const toggleShowArchived = useCallback((value: boolean) => {
        setShowArchived(value);
        try {
            localStorage.setItem(ARCHIVED_SETTING_KEY, String(value));
            // Trigger a custom event so other components know it changed
            window.dispatchEvent(new Event('app-settings-changed'));
        } catch (error) {
            console.error('Failed to save archived setting:', error);
        }
    }, []);

    // Listen for changes from other components (like SettingsDialog)
    useEffect(() => {
        const handleStorageChange = () => {
            try {
                const value = localStorage.getItem(ARCHIVED_SETTING_KEY) === 'true';
                setShowArchived(value);
            } catch (error) {
                console.error('Error reading archived setting:', error);
            }
        };

        window.addEventListener('app-settings-changed', handleStorageChange);
        return () => window.removeEventListener('app-settings-changed', handleStorageChange);
    }, []);

    return {
        showArchived,
        setShowArchived: toggleShowArchived,
    };
};
