import type { FC } from 'react';
import { Users, LineChart, Target, ShieldCheck } from 'lucide-react';

interface DashboardProps {
    totalLeads: number;
    verifiedLeads: number;
}

export const Dashboard: FC<DashboardProps> = ({ totalLeads, verifiedLeads }) => {
    const stats = [
        {
            title: 'Total Leads Found',
            value: totalLeads.toLocaleString(),
            icon: Users,
            trend: '+12%',
            trendUp: true,
            color: 'bg-blue-50 text-blue-600',
        },
        {
            title: 'Verified Contacts',
            value: verifiedLeads.toLocaleString(),
            icon: ShieldCheck,
            trend: '+18%',
            trendUp: true,
            color: 'bg-emerald-50 text-emerald-600',
        },
        {
            title: 'Conversion Rate',
            value: totalLeads > 0 ? `${((verifiedLeads / totalLeads) * 100).toFixed(1)}%` : '0%',
            icon: Target,
            trend: '+5%',
            trendUp: true,
            color: 'bg-indigo-50 text-indigo-600',
        },
        {
            title: 'Search Volume',
            value: '2,405',
            icon: LineChart,
            trend: '+24%',
            trendUp: true,
            color: 'bg-violet-50 text-violet-600',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <div key={index} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                {stat.trend}
                            </span>
                        </div>
                        <h3 className="text-slate-500 text-sm font-medium mb-1">{stat.title}</h3>
                        <p className="text-3xl font-bold text-slate-900 font-brand tracking-tight">{stat.value}</p>
                    </div>
                );
            })}
        </div>
    );
};
