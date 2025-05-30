// src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import { useRouter } from "next/navigation";
import {
  Item,
  Claim,
  CategoryType,
  ItemStatus,
  Profile,
} from "@/types/database";
import { formatDistanceToNow, subDays, format, parseISO } from "date-fns";

// Extended interface for items with profile data from joins
interface ItemWithProfile extends Item {
  profiles?: Pick<Profile, "full_name"> | null;
}
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

// Placeholder for actual CategoryNames if not imported directly or available
// Ideally, this would come from your shared types or constants
const AppCategoryNames: Record<string, string> = {
  electronics: "Electronics",
  accessories: "Accessories",
  clothing: "Clothing",
  books: "Books",
  documents: "Documents",
  keys: "Keys",
  wallet: "Wallet",
  id_cards: "ID Cards",
  other: "Other",
};

interface KpiData {
  totalLostItems: number;
  totalFoundItems: number;
  totalClaimedResolvedItems: number;
  totalUsers: number;
  newUsersLast7Days: number;
}

interface TimeSeriesData {
  date: string;
  lostItems: number;
  foundItems: number;
}

interface CategoryDistributionData {
  name: string;
  value: number;
}

interface ClaimTimeSeriesData {
  date: string;
  approved: number;
  rejected: number;
  pending: number;
}

interface UserActivityData {
  date: string;
  newUsers: number;
}

// KPI Card Component
const KpiCard: React.FC<{
  title: string;
  value: string | number;
  highlight?: boolean;
}> = ({ title, value, highlight = false }) => (
  <div
    className={`bg-gray-800 p-4 rounded-lg shadow-md ${
      highlight ? "border-l-4 border-green-500" : ""
    }`}
  >
    <h3 className="text-sm font-medium text-gray-400 mb-1">{title}</h3>
    <p
      className={`text-3xl font-bold ${
        highlight ? "text-green-400" : "text-indigo-400"
      }`}
    >
      {value}
    </p>
  </div>
);

// Note: ClaimDetailModal component removed as it was defined but never used

// EditItemModal Component
interface EditItemModalProps {
  item: Item;
  onClose: () => void;
  onSave: (item: Item) => Promise<void>;
  categories: Record<string, string>;
  statuses: ItemStatus[];
}

const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  onClose,
  onSave,
  categories,
  statuses,
}) => {
  const [formData, setFormData] = useState<Item>(item);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(item);
  }, [item]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving item:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-xl font-bold mb-4">Edit Item</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description || ""}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2"
              rows={3}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2"
            >
              {Object.entries(categories).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function AdminPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [roleChecked, setRoleChecked] = useState(false);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);

  // Stats state
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<
    CategoryDistributionData[]
  >([]);
  const [claimTimeSeriesData, setClaimTimeSeriesData] = useState<
    ClaimTimeSeriesData[]
  >([]);
  const [userActivityData, setUserActivityData] = useState<UserActivityData[]>(
    []
  );
  const [loadingStats, setLoadingStats] = useState(true);
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [allItems, setAllItems] = useState<ItemWithProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryType | "">("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10; // Constant instead of state since it's never changed
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // State for toggling statistical insights visibility
  const [showStatisticalInsights, setShowStatisticalInsights] = useState(false);

  // Client-side auth and role check
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profileError || !profile || profile.role !== "admin") {
        router.push("/");
      } else {
        setRoleChecked(true);
      }
    }
    checkAuth();
  }, [router, supabase]);

  // Note: handleApproveClaim and handleRejectClaim functions removed as they were defined but never used

  // Fetch data once role is verified
  useEffect(() => {
    if (!roleChecked) return;

    async function fetchData() {
      setLoadingKpis(true);
      setLoadingClaims(true);
      setLoadingItems(true);
      setLoadingStats(true);

      try {
        // Calculate date 7 days ago
        const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

        // Fetch KPIs
        const { count: lostItemsCount } = await supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("status", "lost");
        const { count: foundItemsCount } = await supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("status", "found");
        const { count: claimedResolvedItemsCount } = await supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .in("status", ["claimed", "resolved"]);
        const { count: usersCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });
        const { count: newUsersLast7Days } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", sevenDaysAgo);

        setKpiData({
          totalLostItems: lostItemsCount || 0,
          totalFoundItems: foundItemsCount || 0,
          totalClaimedResolvedItems: claimedResolvedItemsCount || 0,
          totalUsers: usersCount || 0,
          newUsersLast7Days: newUsersLast7Days || 0,
        });

        // Fetch claims
        const { data: claimsData, error: claimsError } = await supabase
          .from("claims")
          .select("*, profiles(full_name), items(*)")
          .order("date_claimed", { ascending: false });
        if (claimsError) throw claimsError;
        setClaims(claimsData as Claim[]);

        // Fetch all items (with filters)
        const { data: itemsData, error: itemsError } = await supabase
          .from("items")
          .select("*, profiles(full_name)")
          .order("created_at", { ascending: false });
        if (itemsError) throw itemsError;
        setAllItems(itemsData as ItemWithProfile[]);

        // Fetch statistical data
        try {
          // 1. Time Series Data - Last 30 days
          const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
          const { data: itemTimeData, error: itemTimeError } = await supabase
            .from("items")
            .select("created_at, status")
            .gte("created_at", thirtyDaysAgo);

          if (itemTimeError) {
            console.error("Error fetching item time data:", itemTimeError);
            throw itemTimeError;
          }
          console.log("Fetched itemTimeData:", itemTimeData);

          // Process time series data by day
          const timeDataByDay: Record<
            string,
            { lostItems: number; foundItems: number }
          > = {};
          if (itemTimeData) {
            itemTimeData.forEach(
              (item: { created_at: string; status: string }) => {
                const day = format(parseISO(item.created_at), "yyyy-MM-dd");
                if (!timeDataByDay[day]) {
                  timeDataByDay[day] = { lostItems: 0, foundItems: 0 };
                }
                if (item.status === "lost") {
                  timeDataByDay[day].lostItems++;
                } else if (item.status === "found") {
                  timeDataByDay[day].foundItems++;
                }
              }
            );
          }

          // Convert to array for recharts
          const timeSeriesArray = Object.keys(timeDataByDay)
            .map((date) => ({
              date,
              lostItems: timeDataByDay[date].lostItems,
              foundItems: timeDataByDay[date].foundItems,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          setTimeSeriesData(timeSeriesArray);

          // 2. Category Distribution
          const { data: categoryData, error: categoryError } = await supabase
            .from("items")
            .select("category_id, categories!inner(name)")
            .not("category_id", "is", null);

          if (categoryError) {
            console.error("Error fetching category data:", categoryError);
            throw categoryError;
          }
          console.log("Fetched categoryData:", categoryData);

          const categoryCounts: Record<string, number> = {};
          if (categoryData) {
            categoryData.forEach(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (item: any) => {
                const categoryName = item.categories?.name || "other";
                categoryCounts[categoryName] =
                  (categoryCounts[categoryName] || 0) + 1;
              }
            );
          }

          const categoryDistributionArray = Object.keys(categoryCounts)
            .map((category) => ({
              name: AppCategoryNames[category as string] || category,
              value: categoryCounts[category],
            }))
            .sort((a, b) => b.value - a.value); // Sort by count descending

          setCategoryDistribution(categoryDistributionArray);

          // 3. Claim Time Series Data
          const { data: claimTimeData, error: claimTimeError } = await supabase
            .from("claims")
            .select("date_claimed, status");

          if (claimTimeError) {
            console.error("Error fetching claim time data:", claimTimeError);
            throw claimTimeError;
          }
          console.log("Fetched claimTimeData:", claimTimeData);

          const claimDataByDay: Record<
            string,
            { approved: number; rejected: number; pending: number }
          > = {};
          if (claimTimeData) {
            claimTimeData.forEach(
              (claim: { date_claimed: string; status: string }) => {
                const day = format(parseISO(claim.date_claimed), "yyyy-MM-dd");
                if (!claimDataByDay[day]) {
                  claimDataByDay[day] = {
                    approved: 0,
                    rejected: 0,
                    pending: 0,
                  };
                }
                if (claim.status === "approved") {
                  claimDataByDay[day].approved++;
                } else if (claim.status === "rejected") {
                  claimDataByDay[day].rejected++;
                } else if (claim.status === "pending") {
                  claimDataByDay[day].pending++;
                }
              }
            );
          }

          const claimTimeSeriesArray = Object.keys(claimDataByDay)
            .map((date) => ({
              date,
              approved: claimDataByDay[date].approved,
              rejected: claimDataByDay[date].rejected,
              pending: claimDataByDay[date].pending,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          setClaimTimeSeriesData(claimTimeSeriesArray);

          // 4. User Activity Over Time
          const { data: userTimeData, error: userTimeError } = await supabase
            .from("profiles")
            .select("created_at");

          if (userTimeError) {
            console.error("Error fetching user time data:", userTimeError);
            throw userTimeError;
          }
          console.log("Fetched userTimeData:", userTimeData);

          const userDataByDay: Record<string, { newUsers: number }> = {};
          if (userTimeData) {
            userTimeData.forEach((user: { created_at: string }) => {
              const day = format(parseISO(user.created_at), "yyyy-MM-dd");
              if (!userDataByDay[day]) {
                userDataByDay[day] = { newUsers: 0 };
              }
              userDataByDay[day].newUsers++;
            });
          }

          const userActivityArray = Object.keys(userDataByDay)
            .map((date) => ({
              date,
              newUsers: userDataByDay[date].newUsers,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          setUserActivityData(userActivityArray);
          console.log("Processed userActivityArray:", userActivityArray);
          setLoadingStats(false);
        } catch (statsErr) {
          console.error("Error fetching statistical data:", statsErr);
          console.error("Stats error message:", (statsErr as Error).message);
          setLoadingStats(false);
        }
      } catch (err) {
        console.error("Error fetching admin data:", err);
        console.error("Admin data error message:", (err as Error).message);
        setLoadingKpis(false);
        setLoadingClaims(false);
        setLoadingItems(false);
        setLoadingStats(false);
      }
    }

    fetchData();
  }, [roleChecked, supabase]);

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* KPI Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Platform Overview</h2>
        {loadingKpis ? (
          <p>Loading KPIs...</p>
        ) : kpiData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Lost Items" value={kpiData.totalLostItems} />
            <KpiCard
              title="Total Found Items"
              value={kpiData.totalFoundItems}
            />
            <KpiCard
              title="Claimed/Resolved"
              value={kpiData.totalClaimedResolvedItems}
            />
            <KpiCard title="Pending Claims" value={claims.length} />
            <KpiCard title="Total Users" value={kpiData.totalUsers} />
            <KpiCard
              title="New Users (7d)"
              value={kpiData.newUsersLast7Days}
              highlight={true}
            />
          </div>
        ) : (
          <p>Could not load KPIs.</p>
        )}
      </section>

      {/* Statistical Insights Section (Collapsible) */}
      <section className="mb-8">
        <h2
          className="text-2xl font-semibold mb-4 cursor-pointer flex items-center"
          onClick={() => setShowStatisticalInsights(!showStatisticalInsights)}
        >
          Statistical Insights
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`ml-2 w-5 h-5 transition-transform ${
              showStatisticalInsights ? "rotate-180" : "rotate-0"
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </h2>
        {showStatisticalInsights &&
          (loadingStats ? (
            <p>Loading statistics...</p>
          ) : (
            <div className="space-y-8">
              {/* Items Over Time Chart */}
              <div className="bg-gray-800 p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-3">
                  Items Reported (Last 30 Days)
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={timeSeriesData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="date" stroke="#ccc" />
                      <YAxis stroke="#ccc" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#333",
                          border: "none",
                          borderRadius: "4px",
                        }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="lostItems"
                        name="Lost Items"
                        stroke="#ef4444"
                        activeDot={{ r: 8 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="foundItems"
                        name="Found Items"
                        stroke="#22c55e"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Distribution Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-3">
                    Items by Category
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {categoryDistribution.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                [
                                  "#8884d8",
                                  "#83a6ed",
                                  "#8dd1e1",
                                  "#82ca9d",
                                  "#a4de6c",
                                  "#d0ed57",
                                  "#ffc658",
                                  "#ff8042",
                                  "#ff6361",
                                  "#bc5090",
                                  "#58508d",
                                  "#003f5c",
                                ][index % 12]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [value, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Claims Over Time Chart */}
                <div className="bg-gray-800 p-4 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-3">
                    Claims Processing
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={claimTimeSeriesData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis dataKey="date" stroke="#ccc" />
                        <YAxis stroke="#ccc" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#333",
                            border: "none",
                            borderRadius: "4px",
                          }}
                          labelStyle={{ color: "#fff" }}
                        />
                        <Legend />
                        <Bar
                          dataKey="approved"
                          name="Approved"
                          stackId="a"
                          fill="#22c55e"
                        />
                        <Bar
                          dataKey="rejected"
                          name="Rejected"
                          stackId="a"
                          fill="#ef4444"
                        />
                        <Bar
                          dataKey="pending"
                          name="Pending"
                          stackId="a"
                          fill="#f59e0b"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* User Activity Chart */}
              <div className="bg-gray-800 p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-3">
                  User Registrations Over Time
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={userActivityData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="date" stroke="#ccc" />
                      <YAxis stroke="#ccc" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#333",
                          border: "none",
                          borderRadius: "4px",
                        }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Legend />
                      <Bar dataKey="newUsers" name="New Users" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ))}
      </section>

      {/* Reported Items Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Recently Reported Items</h2>
        {loadingItems ? (
          <p>Loading reported items...</p>
        ) : (
          <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
            <table className="min-w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Reporter
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Reported
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {allItems
                  .filter(
                    (item) => item.status === "lost" || item.status === "found"
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.created_at || 0).getTime() -
                      new Date(a.created_at || 0).getTime()
                  )
                  .slice(0, 10) // Show only the 10 most recent reported items
                  .map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-750 transition-colors"
                    >
                      <td className="p-3 whitespace-nowrap text-sm text-indigo-400 font-medium">
                        {item.title}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.status === "lost"
                              ? "bg-red-500 text-white"
                              : "bg-green-500 text-white"
                          }`}
                        >
                          {item.status === "lost" ? "Lost Item" : "Found Item"}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-300">
                        {AppCategoryNames[item.category as string] ||
                          item.category}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-300">
                        {item.profiles?.full_name || "Unknown User"}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-400">
                        {item.created_at
                          ? formatDistanceToNow(new Date(item.created_at), {
                              addSuffix: true,
                            })
                          : "Date unknown"}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsEditModalOpen(true);
                          }}
                          className="text-indigo-400 hover:text-indigo-300 font-medium mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            window.open(`/item/${item.id}`, "_blank");
                          }}
                          className="text-green-400 hover:text-green-300 font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {allItems.filter(
          (item) => item.status === "lost" || item.status === "found"
        ).length === 0 &&
          !loadingItems && (
            <p className="text-gray-400 text-center py-8">
              No reported items found.
            </p>
          )}
      </section>

      {/* All Items Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Manage All Items</h2>
        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by title..."
            className="p-2 rounded bg-gray-800 border border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            className="p-2 rounded bg-gray-800 border border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ItemStatus | "");
              setCurrentPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {["lost", "found", "claimed", "resolved", "archived"].map(
              (status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              )
            )}
          </select>
          <select
            className="p-2 rounded bg-gray-800 border border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
            value={categoryFilter}
            onChange={(e) => {
              // Using a proper type guard to handle the category value
              const value = e.target.value;
              if (
                value === "" ||
                value === "keys" ||
                value === "electronics" ||
                value === "apparel" ||
                value === "books" ||
                value === "stationery" ||
                value === "accessories" ||
                value === "documents" ||
                value === "ids_cards" ||
                value === "other"
              ) {
                setCategoryFilter(value);
                setCurrentPage(1);
              }
            }}
          >
            <option value="">All Categories</option>
            {Object.entries(AppCategoryNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="User ID..."
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            className="p-2 rounded bg-gray-800 border border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="p-2 rounded bg-gray-800 border border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="p-2 rounded bg-gray-800 border border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {loadingItems ? (
          <p>Loading items...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-800 rounded-lg shadow-md">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Reported
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {allItems
                  .filter((item: Item) => {
                    const statusMatch = statusFilter
                      ? item.status === statusFilter
                      : true;
                    const categoryMatch = categoryFilter
                      ? item.category === categoryFilter
                      : true;
                    const userIdMatch = userIdFilter
                      ? item.user_id === userIdFilter
                      : true;
                    const dateFromMatch =
                      dateFrom && item.created_at
                        ? new Date(item.created_at).getTime() >=
                          new Date(dateFrom).getTime()
                        : true;
                    const dateToMatch =
                      dateTo && item.created_at
                        ? new Date(item.created_at).getTime() <=
                          new Date(dateTo).getTime()
                        : true;
                    return (
                      statusMatch &&
                      categoryMatch &&
                      userIdMatch &&
                      dateFromMatch &&
                      dateToMatch
                    );
                  })
                  .filter((item) =>
                    item.title.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .slice(
                    (currentPage - 1) * ITEMS_PER_PAGE,
                    currentPage * ITEMS_PER_PAGE
                  )
                  .map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-750 transition-colors"
                    >
                      <td className="p-3 whitespace-nowrap text-sm text-indigo-400 font-medium">
                        {item.title}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm">
                        {/* Using a function to determine badge color to avoid type comparison issues */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(() => {
                            // Cast to string to allow comparison with all possible status values
                            const status = item.status as string;
                            switch (status) {
                              case "lost":
                                return "bg-red-500 text-white";
                              case "found":
                                return "bg-green-500 text-white";
                              case "claimed":
                                return "bg-blue-500 text-white";
                              case "resolved":
                                return "bg-purple-500 text-white";
                              case "archived":
                                return "bg-gray-500 text-white";
                              default:
                                return "bg-gray-500 text-white";
                            }
                          })()}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-300">
                        {AppCategoryNames[item.category as string] ||
                          item.category}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-400">
                        {item.created_at
                          ? formatDistanceToNow(new Date(item.created_at), {
                              addSuffix: true,
                            })
                          : "Date unknown"}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            // Set the item being edited and open the modal
                            setEditingItem(item);
                            setIsEditModalOpen(true);
                          }}
                          className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-xs btn-info mr-2"
                          onClick={async () => {
                            // Fetch and display audit log for this item
                            try {
                              const { data } = await supabase
                                .from("item_audit_logs")
                                .select("*")
                                .eq("item_id", item.id)
                                .order("changed_at", { ascending: false });

                              const historyText =
                                data && data.length > 0
                                  ? data
                                      .map(
                                        (log) =>
                                          `${log.changed_at}: ${log.field_changed} changed from "${log.old_value}" to "${log.new_value}"`
                                      )
                                      .join("\n")
                                  : "No history available for this item.";

                              alert(
                                `History for ${item.title}:\n\n${historyText}`
                              );
                            } catch (error) {
                              console.error(
                                "Error fetching item history:",
                                error
                              );
                              alert("Error loading item history.");
                            }
                          }}
                        >
                          View History
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination Controls */}
        {Math.ceil(
          allItems
            .filter((item) => {
              const statusMatch = statusFilter
                ? item.status === statusFilter
                : true;
              const categoryMatch = categoryFilter
                ? item.category === categoryFilter
                : true;
              const userIdMatch = userIdFilter
                ? item.user_id === userIdFilter
                : true;
              const dateFromMatch =
                dateFrom && item.created_at
                  ? new Date(item.created_at).getTime() >=
                    new Date(dateFrom).getTime()
                  : true;
              const dateToMatch =
                dateTo && item.created_at
                  ? new Date(item.created_at).getTime() <=
                    new Date(dateTo).getTime()
                  : true;
              return (
                statusMatch &&
                categoryMatch &&
                userIdMatch &&
                dateFromMatch &&
                dateToMatch
              );
            })
            .filter((item) =>
              item.title.toLowerCase().includes(searchTerm.toLowerCase())
            ).length / ITEMS_PER_PAGE
        ) > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {currentPage} of{" "}
              {Math.ceil(
                allItems
                  .filter((item) => {
                    const statusMatch = statusFilter
                      ? item.status === statusFilter
                      : true;
                    const categoryMatch = categoryFilter
                      ? item.category === categoryFilter
                      : true;
                    const userIdMatch = userIdFilter
                      ? item.user_id === userIdFilter
                      : true;
                    const dateFromMatch =
                      dateFrom && item.created_at
                        ? new Date(item.created_at).getTime() >=
                          new Date(dateFrom).getTime()
                        : true;
                    const dateToMatch =
                      dateTo && item.created_at
                        ? new Date(item.created_at).getTime() <=
                          new Date(dateTo).getTime()
                        : true;
                    return (
                      statusMatch &&
                      categoryMatch &&
                      userIdMatch &&
                      dateFromMatch &&
                      dateToMatch
                    );
                  })
                  .filter((item) =>
                    item.title.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length / ITEMS_PER_PAGE
              )}
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) =>
                  Math.min(
                    Math.ceil(
                      allItems
                        .filter((item) => {
                          const statusMatch = statusFilter
                            ? item.status === statusFilter
                            : true;
                          const categoryMatch = categoryFilter
                            ? item.category === categoryFilter
                            : true;
                          const userIdMatch = userIdFilter
                            ? item.user_id === userIdFilter
                            : true;
                          const dateFromMatch =
                            dateFrom && item.created_at
                              ? new Date(item.created_at).getTime() >=
                                new Date(dateFrom).getTime()
                              : true;
                          const dateToMatch =
                            dateTo && item.created_at
                              ? new Date(item.created_at).getTime() <=
                                new Date(dateTo).getTime()
                              : true;
                          return (
                            statusMatch &&
                            categoryMatch &&
                            userIdMatch &&
                            dateFromMatch &&
                            dateToMatch
                          );
                        })
                        .filter((item) =>
                          item.title
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase())
                        ).length / ITEMS_PER_PAGE
                    ),
                    prev + 1
                  )
                )
              }
              disabled={
                currentPage ===
                Math.ceil(
                  allItems
                    .filter((item) => {
                      const statusMatch = statusFilter
                        ? item.status === statusFilter
                        : true;
                      const categoryMatch = categoryFilter
                        ? item.category === categoryFilter
                        : true;
                      const userIdMatch = userIdFilter
                        ? item.user_id === userIdFilter
                        : true;
                      const dateFromMatch =
                        dateFrom && item.created_at
                          ? new Date(item.created_at).getTime() >=
                            new Date(dateFrom).getTime()
                          : true;
                      const dateToMatch =
                        dateTo && item.created_at
                          ? new Date(item.created_at).getTime() <=
                            new Date(dateTo).getTime()
                          : true;
                      return (
                        statusMatch &&
                        categoryMatch &&
                        userIdMatch &&
                        dateFromMatch &&
                        dateToMatch
                      );
                    })
                    .filter((item) =>
                      item.title
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                    ).length / ITEMS_PER_PAGE
                )
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Manage Claims Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Manage Claims</h2>
        {loadingClaims ? (
          <p className="text-gray-300">Loading claims...</p>
        ) : claims.filter((claim) => claim.status === "pending").length ===
          0 ? (
          <p className="text-gray-400">No pending claims found.</p>
        ) : (
          <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
            <table className="min-w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Item Title
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Claimant
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Date Claimed
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {claims
                  .filter((claim) => claim.status === "pending")
                  .map((claim) => (
                    <tr
                      key={claim.id}
                      className="hover:bg-gray-750 transition-colors"
                    >
                      <td className="p-3 whitespace-nowrap text-sm text-indigo-400 font-medium">
                        {claim.items?.title || "N/A"}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-300">
                        {claim.profiles?.full_name || "N/A"}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-400">
                        {claim.date_claimed
                          ? format(new Date(claim.date_claimed), "PPpp")
                          : "N/A"}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            claim.status === "approved"
                              ? "bg-green-500 text-white"
                              : claim.status === "rejected"
                              ? "bg-red-500 text-white"
                              : claim.status === "pending"
                              ? "bg-yellow-500 text-black"
                              : "bg-gray-500 text-white"
                          }`}
                        >
                          {claim.status}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            // Simple review action - can be expanded later if detailed claim modal is needed
                            alert(
                              `Reviewing claim for: ${
                                claim.items?.title || "N/A"
                              }\nClaimant: ${
                                claim.profiles?.full_name || "N/A"
                              }\nJustification: ${
                                claim.claim_description ||
                                "No justification provided"
                              }`
                            );
                          }}
                          className="text-indigo-400 hover:text-indigo-300 font-medium py-1 px-2 rounded hover:bg-gray-700 transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Item Modal */}
      {isEditModalOpen && editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => {
            setEditingItem(null);
            setIsEditModalOpen(false);
          }}
          onSave={async (updatedItem) => {
            if (!editingItem) return;
            try {
              const { error } = await supabase
                .from("items")
                .update({
                  title: updatedItem.title,
                  description: updatedItem.description,
                  status: updatedItem.status,
                  category: updatedItem.category,
                })
                .eq("id", editingItem.id);
              if (error) throw error;

              // Refresh item list
              const { data: itemsData, error: itemsError } = await supabase
                .from("items")
                .select("*, profiles(full_name)")
                .order("created_at", { ascending: false });
              if (itemsError) throw itemsError;
              setAllItems(itemsData as ItemWithProfile[]);

              // Close the modal
              setEditingItem(null);
              setIsEditModalOpen(false);
            } catch (err) {
              console.error("Error updating item:", err);
              console.error(
                "Update item error message:",
                (err as Error).message
              );
            }
          }}
          categories={AppCategoryNames}
          statuses={
            [
              "lost",
              "found",
              "claimed",
              "resolved" as ItemStatus,
              "archived",
            ] as ItemStatus[]
          }
        />
      )}
    </div>
  );
}
