import React from "react";
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import DonorTable from "../Components/SurgeryTable.jsx";
import SurgeryProgressChart from "../Components/SurgeryProgressChart";

const HospitalDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [surgeries, setSurgeries] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [selectedFY, setSelectedFY] = useState("2026-2027");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [filterType, setFilterType] = useState("monthly");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [showMonthlySummary, setShowMonthlySummary] = useState(false);

  const [appliedMonth, setAppliedMonth] = useState(new Date().getMonth() + 1);

  const [appliedYear, setAppliedYear] = useState(new Date().getFullYear());

  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardData(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchDashboardData = async (signal) => {
    try {
      const token = localStorage.getItem("token");
      if (!token || token === "undefined" || token === "null") {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL;
      const [projectsRes, surgeriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/projects`, {
          signal,
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/surgeries`, {
          signal,
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
      setSurgeries(Array.isArray(surgeriesRes.data) ? surgeriesRes.data : []);
      setError(null);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      if (error.name === "AbortError" || error.code === "ERR_CANCELED") return;
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to load dashboard data.",
      );
    }
  };

  const getFinancialYear = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const localDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  const stats = useMemo(() => {
    let totalTarget = 0;
    let totalCompleted = 0;
    let totalIncomplete = 0;
    let totalAmountSum = 0; // 1. Add this variable

    projects.forEach((project) => {
      if (!project) return;
      const completed = surgeries.filter(
        (s) => s.projectId === project.id,
      ).length;
      const target = (project.balanceSurgery || 0) + completed;
      const incomplete = Math.max(target - completed, 0);
      totalAmountSum += Number(project.totalAmount || 0); // 2. Add this line

      totalTarget += target;
      totalCompleted += completed;
      totalIncomplete += incomplete;
    });

    const completedProjectsCount = projects.filter(
      (p) => Number(p.balanceSurgery) === 0,
    ).length;

    return {
      totalDonors: projects.length,
      totalTarget,
      completedTarget: totalCompleted,
      incompleteTarget: totalIncomplete,
      completedProjects: completedProjectsCount,
      incompleteProjects: projects.length - completedProjectsCount,
      totalAmount: totalAmountSum, // 3. Include this in the returned stats
    };
  }, [projects, surgeries]);

  // --- DYNAMIC FILTERING (FOR TABLE & CHART ONLY) ---

  const fyFilteredSurgeries = useMemo(() => {
    return surgeries.filter(
      (s) => getFinancialYear(s.dateOfSurgery) === selectedFY,
    );
  }, [surgeries, selectedFY]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Show project if it has surgeries in this FY
      const hasSurgeriesInYear = fyFilteredSurgeries.some(
        (s) => s.projectId === p.id,
      );
      if (!hasSurgeriesInYear) return false;

      // Apply the Status Filter (All/Completed/Incomplete)
      if (projectFilter === "COMPLETED") return Number(p.balanceSurgery) === 0;
      if (projectFilter === "INCOMPLETE") return Number(p.balanceSurgery) > 0;
      return true;
    });
  }, [projects, fyFilteredSurgeries, projectFilter]);

  // MONTHLY SURGIERIES REPROT
  const monthlyFilteredSurgeries = useMemo(() => {
    if (filterType !== "monthly") return [];

    return surgeries.filter((s) => {
      if (!s.dateOfSurgery) return false;

      const d = new Date(s.dateOfSurgery);

      const localDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      return (
        localDate.getFullYear() === Number(appliedYear) &&
        localDate.getMonth() + 1 === Number(appliedMonth)
      );
    });
  }, [surgeries, appliedYear, appliedMonth, filterType]);

  const monthlyProjects = useMemo(() => {
    return projects.filter((project) =>
      monthlyFilteredSurgeries.some((s) => s.projectId === project.id),
    );
  }, [projects, monthlyFilteredSurgeries]);

  const monthlyStats = useMemo(() => {
    let totalTarget = 0;
    let totalCompleted = 0;
    let totalIncomplete = 0;
    let totalAmount = 0;

    monthlyProjects.forEach((project) => {
      const completed = monthlyFilteredSurgeries.filter(
        (s) => s.projectId === project.id,
      ).length;

      const lifetimeCompleted = surgeries.filter(
        (s) => s.projectId === project.id,
      ).length;

      const target = Number(project.balanceSurgery || 0) + lifetimeCompleted;

      const cumulativeCompleted = surgeries.filter((s) => {
        if (s.projectId !== project.id || !s.dateOfSurgery) return false;

        const d = new Date(s.dateOfSurgery);

        return (
          d.getFullYear() < appliedYear ||
          (d.getFullYear() === appliedYear && d.getMonth() + 1 <= appliedMonth)
        );
      }).length;

      const incomplete = Math.max(target - cumulativeCompleted, 0);

      totalTarget += target;
      totalCompleted += completed;
      totalIncomplete += incomplete;
      totalAmount += Number(project.totalAmount || 0);
    });

    const completedProjects = monthlyProjects.filter((project) => {
      const lifetimeCompleted = surgeries.filter(
        (s) => s.projectId === project.id,
      ).length;

      const target = Number(project.balanceSurgery || 0) + lifetimeCompleted;

      const cumulativeCompleted = surgeries.filter((s) => {
        if (s.projectId !== project.id || !s.dateOfSurgery) return false;

        const d = new Date(s.dateOfSurgery);

        return (
          d.getFullYear() < appliedYear ||
          (d.getFullYear() === appliedYear && d.getMonth() + 1 <= appliedMonth)
        );
      }).length;

      return cumulativeCompleted >= target;
    }).length;

    return {
      totalProjects: monthlyProjects.length,
      totalValue: totalAmount,
      totalTarget,
      completedSurgeries: totalCompleted,
      incompleteSurgeries: totalIncomplete,
      completedProjects,
      incompleteProjects: monthlyProjects.length - completedProjects,
    };
  }, [monthlyProjects, monthlyFilteredSurgeries, surgeries]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  if (loading) return <div className="p-6 animate-pulse">Loading...</div>;

  const formatINR = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Project Management Dashboard
        </h1>
        <div className="flex gap-3 items-center">
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            className="border px-3 py-2 rounded-lg bg-white shadow-sm"
          >
            <option value="2023-2024">2023-2024</option>
            <option value="2024-2025">2024-2025</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2026-2027">2026-2027</option>
          </select>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Master Data</h2>

        {/* STAT CARDS - These are now STATIC/LIFETIME */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-6">
          <StatCard
            title="All Projects"
            value={stats.totalDonors}
            color="text-gray-800"
            onClick={() => setProjectFilter("ALL")}
            active={projectFilter === "ALL"}
          />
          <StatCard
            title="Total Value"
            value={formatINR(stats.totalAmount)}
            color="text-amber-600"
            onClick={() => setIsModalOpen(true)} // Add this
          />
          <StatCard
            title="Total Target"
            value={stats.totalTarget}
            color="text-indigo-600"
          />
          <StatCard
            title="Completed Surgeries"
            value={stats.completedTarget}
            color="text-green-600"
          />
          <StatCard
            title="Incomplete Surgeries"
            value={stats.incompleteTarget}
            color="text-red-600"
          />
          <StatCard
            title="Completed Project"
            value={stats.completedProjects}
            color="text-purple-600"
            onClick={() => setProjectFilter("COMPLETED")}
            active={projectFilter === "COMPLETED"}
          />
          <StatCard
            title="Incomplete Project"
            value={stats.incompleteProjects}
            color="text-blue-600"
            onClick={() => setProjectFilter("INCOMPLETE")}
            active={projectFilter === "INCOMPLETE"}
          />
        </div>
      </div>

      {filterType === "monthly" && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              Monthly Summary -{" "}
              {new Date(appliedYear, appliedMonth - 1).toLocaleString(
                "default",
                {
                  month: "long",
                  year: "numeric",
                },
              )}
            </h2>

            <button
              onClick={() => setShowMonthlySummary(!showMonthlySummary)}
              className="bg-white border rounded-lg px-3 py-2 shadow-sm hover:bg-gray-100 transition"
            >
              {showMonthlySummary ? "▲" : "▼"}
            </button>
          </div>

          {showMonthlySummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-6">
              <StatCard
                title="All Projects"
                value={monthlyStats.totalProjects}
                color="text-gray-800"
              />

              <StatCard
                title="Total Value"
                value={formatINR(monthlyStats.totalValue)}
                color="text-amber-600"
              />

              <StatCard
                title="Total Target"
                value={monthlyStats.totalTarget}
                color="text-indigo-600"
              />

              <StatCard
                title="Completed Surgeries"
                value={monthlyStats.completedSurgeries}
                color="text-green-600"
              />

              <StatCard
                title="Incomplete Surgeries"
                value={monthlyStats.incompleteSurgeries}
                color="text-red-600"
              />

              <StatCard
                title="Completed Projects"
                value={monthlyStats.completedProjects}
                color="text-purple-600"
              />

              <StatCard
                title="Incomplete Projects"
                value={monthlyStats.incompleteProjects}
                color="text-blue-600"
              />
            </div>
          )}
        </div>
      )}
      {/* TABLE - This is DYNAMIC (Filtered by Year) */}
      <div className="bg-white rounded-xl shadow p-6">
        <DonorTable
          projects={filteredProjects}
          surgeries={fyFilteredSurgeries}
          filterType={filterType}
          setFilterType={setFilterType}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          appliedMonth={appliedMonth}
          setAppliedMonth={setAppliedMonth}
          appliedYear={appliedYear}
          setAppliedYear={setAppliedYear}
          showMonthlySummary={showMonthlySummary}
          setShowMonthlySummary={setShowMonthlySummary}
        />
      </div>

      {/* CHART - This is DYNAMIC (Filtered by Year) */}
      <div className="bg-white rounded-xl shadow p-6">
        <SurgeryProgressChart surgeries={fyFilteredSurgeries} />
      </div>

      {/* ... existing code ... */}
      <AmountDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projects={projects}
        surgeries={surgeries}
        formatINR={formatINR}
      />
    </div> // Closing main div
  );
};

const StatCard = ({ title, value, color, onClick, active }) => (
  <div
    onClick={onClick}
    className={`cursor-pointer bg-white rounded-2xl shadow-sm p-5 border transition ${active ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"}`}
  >
    <p className="text-gray-500 text-sm font-medium">{title}</p>
    <h2 className={`text-3xl font-bold mt-1 ${color}`}>{value}</h2>
  </div>
);

const AmountDetailsModal = ({
  isOpen,
  onClose,
  projects,
  surgeries,
  formatINR,
}) => {
  if (!isOpen) return null;

  return (
    // BLURRED BACKGROUND FIX
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-md p-4 transition-all">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-200">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">
            Financial Project Breakdown
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 text-3xl font-light"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-xs uppercase text-gray-600 tracking-wider">
                <th className="p-4 border">Donor / Project</th>
                <th className="p-4 border text-right">Total Budget</th>
                <th className="p-4 border text-right">Amount Used</th>
                <th className="p-4 border text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {projects.map((p) => {
                const totalBudget = Number(p.totalAmount || 0);
                // FIXED FIELD NAME: matches your screenshot 'perSurgeryAmount'
                const perSurgery = Number(p.perSurgeryAmount || 0);

                const completedCount = surgeries.filter(
                  (s) => s.projectId?.toString() === p.id?.toString(),
                ).length;

                const isFinished = Number(p.balanceSurgery) === 0;
                const amountUsed = isFinished
                  ? totalBudget
                  : completedCount * perSurgery;
                const remaining = Math.max(totalBudget - amountUsed, 0);

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="p-4 border font-medium text-gray-700">
                      {p.projectName}
                      <span className="text-xs text-gray-400 block font-normal">
                        ({completedCount} surgeries @ {formatINR(perSurgery)})
                      </span>
                    </td>
                    <td className="p-4 border text-right text-gray-600">
                      {formatINR(totalBudget)}
                    </td>
                    <td className="p-4 border text-right text-green-600 font-semibold">
                      {formatINR(amountUsed)}
                    </td>
                    <td className="p-4 border text-right text-red-500 font-semibold">
                      {formatINR(remaining)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* GRAND TOTAL FOOTER */}
            <tfoot className="bg-gray-900 text-white">
              <tr className="font-bold">
                <td className="p-4 border uppercase tracking-widest text-xs">
                  Grand Total
                </td>
                <td className="p-4 border text-right">
                  {formatINR(
                    projects.reduce(
                      (sum, p) => sum + Number(p.totalAmount || 0),
                      0,
                    ),
                  )}
                </td>
                <td className="p-4 border text-right text-green-400">
                  {formatINR(
                    projects.reduce((sum, p) => {
                      const isFinished = Number(p.balanceSurgery) === 0;
                      const count = surgeries.filter(
                        (s) => s.projectId?.toString() === p.id?.toString(),
                      ).length;
                      return (
                        sum +
                        (isFinished
                          ? Number(p.totalAmount || 0)
                          : count * Number(p.perSurgeryAmount || 0))
                      );
                    }, 0),
                  )}
                </td>
                <td className="p-4 border text-right text-red-400">
                  {formatINR(
                    projects.reduce((sum, p) => {
                      const total = Number(p.totalAmount || 0);
                      const isFinished = Number(p.balanceSurgery) === 0;
                      const count = surgeries.filter(
                        (s) => s.projectId?.toString() === p.id?.toString(),
                      ).length;
                      const used = isFinished
                        ? total
                        : count * Number(p.perSurgeryAmount || 0);
                      return sum + Math.max(total - used, 0);
                    }, 0),
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-800 text-white px-8 py-2.5 rounded-xl hover:bg-black transition-all shadow-lg active:scale-95"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
export default HospitalDashboard;
