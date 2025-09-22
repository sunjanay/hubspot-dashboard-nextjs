import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Dashboard data API route.
 *
 * Fetches HubSpot ticket data and generates dashboard analytics using EXACT logic from Python version.
 */

interface HubSpotTicket {
  id: string;
  status: string;
  created_at: string;
  properties: {
    subject?: string;
    content?: string;
    hs_pipeline_stage?: string;
    hs_ticket_priority?: string;
    source_type?: string;
    hs_ticket_category?: string;
    hubspot_owner_id?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    closed_date?: string;
    time_to_close?: string;
    service_provided?: string;
    county?: string;
    zip_code_for_request?: string;
    amount_needed?: string;
    crisis_wish?: string;
    birthday?: string;
  };
}

interface DashboardStats {
  open_tickets: number;
  new_tickets_this_week: number;
  osw_count: number;
  staffmark_count: number;
  closed_tickets: number;
}

interface DashboardResponse {
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

// EXACT status mapping from Python models.py
function getStatusFromStage(stageId: string | undefined): string {
  if (!stageId) return 'UNKNOWN';

  const stageMapping: Record<string, string> = {
    '1': 'NEW',
    '2': 'BACKLOG',
    '3': 'RESOURCE_SUPPORT',
    '4': 'CLOSED',
    '257285392': 'WAITING_FOR_RESPONSE',
    '257285393': 'COMPLETED',
    '1686843097': 'IN_PROCESS_STAFFMARK',
    '1687677633': 'EMPLOYMENT_SUPPORT',
    '999098012': 'IN_PROCESS_OSW',
    '1746656967': 'ARCHIVED'
  };

  return stageMapping[stageId] || `STAGE_${stageId}`;
}

async function fetchHubSpotTickets(): Promise<HubSpotTicket[]> {
  const apiKey = process.env.HUBSPOT_API_KEY;

  if (!apiKey) {
    throw new Error('HUBSPOT_API_KEY environment variable is not set');
  }

  const properties = [
    'subject', 'content', 'hs_pipeline_stage', 'hs_ticket_priority',
    'source_type', 'hs_ticket_category', 'hubspot_owner_id',
    'createdate', 'hs_lastmodifieddate',
    'closed_date', 'time_to_close',
    'service_provided', 'county', 'zip_code_for_request',
    'amount_needed', 'crisis_wish', 'birthday'
  ];

  let allTickets: HubSpotTicket[] = [];
  let after: string | undefined;

  try {
    while (true) {
      const url = new URL('https://api.hubapi.com/crm/v3/objects/tickets');
      url.searchParams.append('limit', '100');
      url.searchParams.append('properties', properties.join(','));

      if (after) {
        url.searchParams.append('after', after);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Transform tickets to match Python format
      const transformedTickets = data.results?.map((ticket: any) => ({
        id: ticket.id,
        status: getStatusFromStage(ticket.properties?.hs_pipeline_stage),
        created_at: ticket.properties?.createdate,
        properties: ticket.properties
      })) || [];

      allTickets = allTickets.concat(transformedTickets);

      // Check for pagination
      if (!data.paging?.next?.after) {
        break;
      }
      after = data.paging.next.after;
    }

    return allTickets;
  } catch (error) {
    console.error('Error fetching HubSpot tickets:', error);
    throw error;
  }
}

// EXACT logic from Python dashboard.py get_dashboard_stats()
function generateDashboardStats(tickets: HubSpotTicket[]): DashboardStats {
  if (!tickets.length) {
    return {
      open_tickets: 0,
      new_tickets_this_week: 0,
      osw_count: 0,
      staffmark_count: 0,
      closed_tickets: 0,
    };
  }

  const openStatuses = ['NEW', 'BACKLOG', 'RESOURCE_SUPPORT', 'EMPLOYMENT_SUPPORT', 'IN_PROCESS_STAFFMARK', 'IN_PROCESS_OSW', 'WAITING_FOR_RESPONSE'];
  const closedStatuses = ['CLOSED', 'COMPLETED', 'ARCHIVED'];

  const openTickets = tickets.filter(ticket => openStatuses.includes(ticket.status)).length;
  const closedTickets = tickets.filter(ticket => closedStatuses.includes(ticket.status)).length;

  // EXACT OSW and Staffmark counting logic
  const oswCount = tickets.filter(ticket => ticket.status === 'IN_PROCESS_OSW').length;
  const staffmarkCount = tickets.filter(ticket => ticket.status === 'IN_PROCESS_STAFFMARK').length;

  // Get new tickets this week (EXACT logic from Python)
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);

  const newTicketsThisWeek = tickets.filter(ticket => {
    if (!ticket.created_at) return false;
    const createdDate = new Date(ticket.created_at);
    return createdDate >= startOfWeek;
  }).length;

  return {
    open_tickets: openTickets,
    new_tickets_this_week: newTicketsThisWeek,
    osw_count: oswCount,
    staffmark_count: staffmarkCount,
    closed_tickets: closedTickets,
  };
}

// EXACT chart generation logic from Python
function generateCharts(tickets: HubSpotTicket[]): DashboardResponse['charts'] {
  // Resource Support Chart - EXACT logic from create_resource_support_chart()
  const resourceSupportCount = tickets.filter(ticket => ticket.status === 'RESOURCE_SUPPORT').length;
  const waitingResponseCount = tickets.filter(ticket => ticket.status === 'WAITING_FOR_RESPONSE').length;

  const resourceChart = {
    data: [{
      x: ['Resource', 'Waiting'],
      y: [resourceSupportCount, waitingResponseCount],
      type: 'bar',
      marker: {
        color: ['#E74C3C', '#D6E9F5'],
        cornerradius: 8,
        line: { width: 0 }
      },
      text: [resourceSupportCount.toString(), waitingResponseCount.toString()],
      textposition: 'outside',
      width: 0.6
    }],
    layout: {
      height: 180,
      showlegend: false,
      margin: { l: 15, r: 15, t: 5, b: 25 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { family: "system-ui, sans-serif" },
      xaxis: {
        fixedrange: true,
        showgrid: false,
        showline: false,
        zeroline: false,
        tickfont: { size: 11, color: '#64748b' }
      },
      yaxis: {
        fixedrange: true,
        showgrid: true,
        gridcolor: 'rgba(226, 232, 240, 0.5)',
        showline: false,
        zeroline: false,
        tickfont: { size: 9, color: '#94a3b8' }
      }
    }
  };

  // Service Provided Chart - EXACT logic from create_service_provided_chart()
  const serviceCounts: Record<string, number> = {};
  tickets.forEach(ticket => {
    const service = ticket.properties.service_provided;
    if (service && service !== 'null' && service !== '') {
      serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    }
  });

  const serviceChart = {
    data: [{
      labels: Object.keys(serviceCounts),
      values: Object.values(serviceCounts),
      type: 'pie',
      hole: 0.4,
      marker: {
        colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#14B8A6'],
        line: { color: '#FFFFFF', width: 2 }
      },
      textinfo: 'none',
      showlegend: true
    }],
    layout: {
      height: 300,
      showlegend: true,
      legend: {
        orientation: "h",
        yanchor: "top",
        y: -0.15,
        xanchor: "center",
        x: 0.5,
        font: { size: 9 },
        itemsizing: "constant",
        itemclick: "toggleothers"
      },
      margin: { l: 10, r: 10, t: 10, b: 70 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { family: "system-ui, sans-serif" }
    }
  };

  // Crisis Wish Tracking - EXACT logic from create_crisis_wish_tracking()
  const crisisData: Array<{ date: Date; amount: number }> = [];
  tickets.forEach(ticket => {
    const crisisWish = ticket.properties.crisis_wish;
    const createdAt = ticket.created_at;

    if (crisisWish && createdAt) {
      try {
        const amount = parseFloat(crisisWish);
        if (!isNaN(amount)) {
          crisisData.push({
            date: new Date(createdAt),
            amount: amount
          });
        }
      } catch (e) {
        // Skip invalid amounts
      }
    }
  });

  // Sort by date and create running tallies
  crisisData.sort((a, b) => a.date.getTime() - b.date.getTime());

  const runningCounts: number[] = [];
  const runningTotals: number[] = [];
  const dates: string[] = [];

  let runningTotal = 0;
  crisisData.forEach((item, index) => {
    runningCounts.push(index + 1);
    runningTotal += item.amount;
    runningTotals.push(runningTotal);
    dates.push(item.date?.toISOString().split('T')[0] || '');
  });

  const crisisChart = {
    data: [
      {
        x: dates,
        y: runningCounts,
        type: 'bar',
        name: 'Crisis Wish Count',
        marker: { color: '#C73E1D', cornerradius: 4 },
        text: runningCounts.map(c => c.toString()),
        textposition: 'outside',
        yaxis: 'y',
        offsetgroup: 1
      },
      {
        x: dates,
        y: runningTotals,
        type: 'scatter',
        mode: 'lines+markers+text',
        name: 'Running Total ($)',
        line: { color: '#F18F01', width: 4 },
        marker: { size: 10, color: '#F18F01' },
        text: runningTotals.map(t => `$${t.toLocaleString()}`),
        textposition: 'top center',
        yaxis: 'y2'
      }
    ],
    layout: {
      height: 400,
      showlegend: true,
      margin: { l: 60, r: 60, t: 40, b: 60 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { family: "system-ui, sans-serif" },
      xaxis: {
        title: 'Date',
        type: 'category'
      },
      yaxis: {
        title: 'Crisis Wish Count',
        side: 'left'
      },
      yaxis2: {
        title: 'Running Total ($)',
        overlaying: 'y',
        side: 'right'
      }
    }
  };

  // Age Demographics - EXACT logic from create_age_demographics_chart()
  const ages: number[] = [];
  const currentDate = new Date();

  tickets.forEach(ticket => {
    const birthday = ticket.properties.birthday;
    if (birthday) {
      try {
        const birthDate = new Date(birthday);
        const age = Math.floor((currentDate.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age >= 0 && age <= 120) { // Valid age range
          ages.push(age);
        }
      } catch (e) {
        // Skip invalid birthdays
      }
    }
  });

  // Create age groups in ascending order - EXACT logic from Python
  const ageGroupsOrdered: Array<[string, number]> = [
    ['0-17', 0], ['18-24', 0], ['25-34', 0], ['35-44', 0],
    ['45-54', 0], ['55-64', 0], ['65+', 0]
  ];

  ages.forEach(age => {
    if (age < 18) {
      ageGroupsOrdered[0]![1]++;
    } else if (age < 25) {
      ageGroupsOrdered[1]![1]++;
    } else if (age < 35) {
      ageGroupsOrdered[2]![1]++;
    } else if (age < 45) {
      ageGroupsOrdered[3]![1]++;
    } else if (age < 55) {
      ageGroupsOrdered[4]![1]++;
    } else if (age < 65) {
      ageGroupsOrdered[5]![1]++;
    } else {
      ageGroupsOrdered[6]![1]++;
    }
  });

  // Filter out empty groups but keep order
  const filteredGroups = ageGroupsOrdered.filter(([, count]) => count > 0);

  const ageChart = filteredGroups.length > 0 ? {
    data: [{
      x: filteredGroups.map(([, count]) => count),
      y: filteredGroups.map(([label]) => label),
      type: 'bar',
      orientation: 'h', // Horizontal bar chart like Python version
      marker: {
        color: '#2E86AB',
        cornerradius: 4
      },
      text: filteredGroups.map(([label, count]) => count.toString()),
      textposition: 'outside',
      textfont: { size: 14, weight: 'bold', color: '#0f172a' }
    }],
    layout: {
      title: `Age Demographics Distribution (${ages.length} people)`,
      height: 400,
      margin: { l: 60, r: 20, t: 40, b: 40 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { family: "system-ui, sans-serif" },
      xaxis: {
        title: 'Count',
        fixedrange: true,
        showgrid: true,
        gridcolor: 'rgba(226, 232, 240, 0.5)'
      },
      yaxis: {
        title: 'Age Group',
        fixedrange: true,
        showgrid: false
      }
    }
  } : {
    data: [],
    layout: {
      title: 'Age Demographics - No Data Available',
      height: 400,
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
    }
  };

  return {
    resource_support: JSON.stringify(resourceChart),
    service_provided: JSON.stringify(serviceChart),
    crisis_wish_tracking: JSON.stringify(crisisChart),
    age_demographics: JSON.stringify(ageChart),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('Fetching HubSpot tickets...');
    const tickets = await fetchHubSpotTickets();
    console.log(`Fetched ${tickets.length} tickets`);

    const stats = generateDashboardStats(tickets);
    const charts = generateCharts(tickets);

    console.log('Dashboard stats:', stats);

    const response: DashboardResponse = {
      success: true,
      stats,
      charts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
      },
      { status: 500 }
    );
  }
}