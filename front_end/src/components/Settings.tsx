import { Moon, Sun } from 'lucide-react';

interface SettingsProps {
    isDarkMode: boolean;
    setIsDarkMode: (val: boolean) => void;
}

export function Settings({ isDarkMode, setIsDarkMode }: SettingsProps) {
    return (
        <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 transition-colors duration-200">
                    Settings
                </h1>

                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden transition-colors duration-200">
                    <div className="p-6">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 transition-colors duration-200">
                            Theme Preferences
                        </h2>

                        <div className="flex items-center justify-between py-4 border-t border-gray-100 dark:border-zinc-800 transition-colors duration-200">
                            <div className="flex flex-col">
                                <span className="text-gray-900 dark:text-white font-medium transition-colors duration-200">
                                    Dark Mode
                                </span>
                                <span className="text-gray-500 dark:text-zinc-400 text-sm transition-colors duration-200">
                                    Adjust the appearance of your dashboard.
                                </span>
                            </div>

                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isDarkMode ? 'bg-blue-600' : 'bg-gray-300'
                                    }`}
                            >
                                <span className="sr-only">Toggle Dark Mode</span>
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                                {isDarkMode ? (
                                    <Moon className="absolute left-1.5 h-3 w-3 text-blue-200" />
                                ) : (
                                    <Sun className="absolute right-1.5 h-3 w-3 text-gray-500" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
