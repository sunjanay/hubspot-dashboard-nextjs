'use client';

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ThemeToggle } from '@/components/theme-toggle';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface DashboardStats {
  open_tickets: number;
  new_tickets_this_week: number;
  osw_count: number;
  staffmark_count: number;
  closed_tickets: number;
}

interface DashboardData {
  success: boolean;
  stats: DashboardStats;
  charts: {
    resource_support: string;
    service_provided: string;
    crisis_wish_tracking: string;
    age_demographics: string;
  };
  error?: string;
}

export default function Dashboard(): ReactElement {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard-data');

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const dashboardData = await response.json() as DashboardData;

      if (dashboardData.success) {
        setData(dashboardData);
      } else {
        setError(dashboardData.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Load error:', err);
      setError('Cannot connect to server. Please check if the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const createChart = (chartData: string): any => {
    if (!chartData || chartData === '{}') {
      return null;
    }

    try {
      return JSON.parse(chartData);
    } catch (e) {
      console.error('Chart parsing error:', e);
      return null;
    }
  };

  const createCrisisWishChart = (chartData: string): any => {
    if (!chartData || chartData === '{}') {
      return null;
    }

    try {
      const chart = JSON.parse(chartData);

      // Modify only the Crisis Wish Tracking chart
      if (chart.layout) {
        chart.layout = {
          ...chart.layout,
          margin: {
            ...chart.layout.margin,
            b: 80 // Increase bottom margin for legend
          },
          legend: {
            ...chart.layout.legend,
            x: 0,
            y: -0.2,
            orientation: 'h'
          }
        };

        // Update x-axis to show months
        chart.layout.xaxis = {
          ...chart.layout.xaxis,
          tickformat: '%b %Y', // Format as "Jan 2024"
          dtick: 'M1', // Show monthly ticks
          tickmode: 'linear',
          type: 'date',
          automargin: true
        };
      }

      return chart;
    } catch (e) {
      console.error('Chart parsing error:', e);
      return null;
    }
  };

  const createStatusPieChart = (): any => {
    if (!data) return null;

    const openTickets = data.stats.open_tickets || 0;
    const closedTickets = data.stats.closed_tickets || 0;
    const total = openTickets + closedTickets;
    const closedPercentage = total > 0 ? Math.round((closedTickets / total) * 100) : 0;

    return {
      data: [{
        values: [closedTickets, openTickets],
        labels: ['Closed', 'Open'],
        type: 'pie',
        hole: 0.6,
        marker: {
          colors: ['#1E5F99', '#F39C12'],
          line: {
            color: '#FFFFFF',
            width: 3
          }
        },
        textinfo: 'none',
        hovertemplate: '<b>%{label}</b><br>Count: %{value}<br>Percentage: %{percent}<extra></extra>',
        showlegend: false
      }],
      layout: {
        height: 220,
        showlegend: false,
        margin: { l: 20, r: 20, t: 10, b: 10 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        annotations: [{
          text: `${closedPercentage}%`,
          x: 0.5,
          y: 0.5,
          font: {
            size: 28,
            color: 'rgb(107, 114, 128)',
            weight: 'bold'
          },
          showarrow: false
        }]
      }
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-800 flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md text-center">
          <h3 className="font-bold">Unable to load dashboard</h3>
          <p>{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pieChartData = createStatusPieChart();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-800 dark:from-gray-900 dark:to-gray-800">
      <ThemeToggle />
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
            HubSpot Dashboard
          </h1>
          <p className="text-blue-200 text-lg">Monitor your ticket requests</p>
        </div>

        {/* Primary Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Pie Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 text-center">
              Ticket Status Overview
            </h3>
            {pieChartData && (
              <Plot
                data={pieChartData.data}
                layout={pieChartData.layout}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            )}
            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-800 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300">Closed ({data ? Math.round((data.stats.closed_tickets / (data.stats.open_tickets + data.stats.closed_tickets)) * 100) : 0}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300">Open ({data ? Math.round((data.stats.open_tickets / (data.stats.open_tickets + data.stats.closed_tickets)) * 100) : 0}%)</span>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-6 text-center">
              Open Tickets This Week
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-800 mb-1">
                  {data?.stats.open_tickets || 0}
                </div>
                <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Open
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-500 mb-1">
                  {data?.stats.new_tickets_this_week || 0}
                </div>
                <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  New
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Analytics */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-white mb-2">Workflow Analytics</h2>
          <p className="text-blue-200">Track ticket progress across different stages</p>
        </div>

        {/* Process Counts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
              Staffmark Process
            </h3>
            <div className="text-4xl font-bold text-blue-800">
              {data?.stats.staffmark_count || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
              OSW Process
            </h3>
            <div className="text-4xl font-bold text-blue-800">
              {data?.stats.osw_count || 0}
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Resource Support Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 text-center">
              Resource Support
            </h3>
            {data?.charts.resource_support && createChart(data.charts.resource_support) ? (
              <Plot
                data={createChart(data.charts.resource_support).data}
                layout={createChart(data.charts.resource_support).layout}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">No data available</div>
            )}
          </div>

          {/* Service Provided Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 text-center">
              Services Provided
            </h3>
            {data?.charts.service_provided && createChart(data.charts.service_provided) ? (
              <Plot
                data={createChart(data.charts.service_provided).data}
                layout={createChart(data.charts.service_provided).layout}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">No data available</div>
            )}
          </div>
        </div>

        {/* Advanced Analytics */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-white mb-2">Advanced Analytics</h2>
          <p className="text-blue-200">Crisis tracking and demographics</p>
        </div>

        {/* Crisis and Demographics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Crisis Wish Tracking */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 text-center">
              Crisis Wish Tracking
            </h3>
            {data?.charts.crisis_wish_tracking && createCrisisWishChart(data.charts.crisis_wish_tracking) ? (
              <Plot
                data={createCrisisWishChart(data.charts.crisis_wish_tracking).data}
                layout={createCrisisWishChart(data.charts.crisis_wish_tracking).layout}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">No data available</div>
            )}
          </div>

          {/* Age Demographics */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 text-center">
              Age Demographics
            </h3>
            {data?.charts.age_demographics && createChart(data.charts.age_demographics) ? (
              <Plot
                data={createChart(data.charts.age_demographics).data}
                layout={createChart(data.charts.age_demographics).layout}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}