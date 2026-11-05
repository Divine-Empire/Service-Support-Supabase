import { useMemo } from "react";
import { Modal } from "../../components/ui/modal";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { parseIST } from "../../lib/dateIST";

// Busy/free segments of today's 9 AM - 7 PM shift for one engineer.
const getTodayAvailability = (engineer, calendarHistoryData) => {
  const today = new Date();
  const cellDate = {
    day: today.getDate(),
    month: today.getMonth(),
    year: today.getFullYear(),
  };

  const busyMinutes = new Array(600).fill(false);
  let statusText = "Available all day (9 AM - 7 PM)";
  let isPendingTADA = false;

  // Filter tickets assigned to this engineer
  const engVisits = calendarHistoryData.filter(ticket => 
    ticket.engineerAssign && 
    String(ticket.engineerAssign).toLowerCase() === String(engineer).toLowerCase()
  );

  const cellVal = cellDate.year * 10000 + (cellDate.month + 1) * 100 + cellDate.day;

  for (const ticket of engVisits) {
    if (!ticket.dateOfVisit) continue;
    const parsedVisit = parseIST(ticket.dateOfVisit);
    if (!parsedVisit) continue;
    
    const parsedTravel = ticket.travelDate ? parseIST(ticket.travelDate) : null;
    const visitVal = parsedTravel ? (parsedTravel.year * 10000 + (parsedTravel.month + 1) * 100 + parsedTravel.day) : (parsedVisit.year * 10000 + (parsedVisit.month + 1) * 100 + parsedVisit.day);

    const rawCompDate = ticket.expectedCompletionDate || ticket.returnDate;
    const rawCompTime = ticket.expectedCompletionTime;

    let compVal = visitVal;

    if (rawCompDate) {
      const parsedComp = parseIST(rawCompDate);
      if (parsedComp) {
        compVal = parsedComp.year * 10000 + (parsedComp.month + 1) * 100 + parsedComp.day;
      }
    }

    // If selected date (today) is outside of [visitVal, compVal], ignore this ticket
    if (cellVal < visitVal || cellVal > compVal) {
      continue;
    }

    const formatDateLabel = (dateStr) => {
      if (!dateStr) return "";
      const parsed = parseIST(dateStr);
      if (!parsed) return dateStr;
      const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${parsed.day} ${monthsShort[parsed.month]}`;
    };

    const formatTime12h = (timeStr) => {
      if (!timeStr) return "";
      const parts = timeStr.split(":");
      if (parts.length < 2) return timeStr;
      let hrs = parseInt(parts[0], 10);
      const mins = parseInt(parts[1], 10);
      if (isNaN(hrs) || isNaN(mins)) return timeStr;
      const ampm = hrs >= 12 ? "PM" : "AM";
      hrs = hrs % 12;
      if (hrs === 0) hrs = 12;
      const minsStr = String(mins).padStart(2, "0");
      return `${hrs}:${minsStr} ${ampm}`;
    };

    const getRelativeMinutes = (timeStr) => {
      if (!timeStr) return 600;
      const parts = timeStr.split(":");
      if (parts.length < 2) return 600;
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (isNaN(hours) || isNaN(minutes)) return 600;
      const totalMinutes = hours * 60 + minutes;
      const nineAM = 9 * 60; // 540
      return Math.max(0, Math.min(600, totalMinutes - nineAM));
    };

    if (ticket.type === "Video Call") {
      const timeStr = rawCompTime || "10:00";
      const startMin = getRelativeMinutes(timeStr);
      const endMin = startMin + 30; // 30 mins slot
      for (let m = startMin; m < Math.min(600, endMin); m++) busyMinutes[m] = true;
      if (statusText === "Available all day (9 AM - 7 PM)") {
        statusText = `Video Call at ${formatTime12h(timeStr)}`;
      } else if (!statusText.includes("Video Call")) {
        statusText += `, Video Call`;
      }
      continue;
    }

    if (ticket.type === "Repair") {
      const startMin = 120; // 11:00 AM
      const endMin = 360;   // 3:00 PM
      for (let m = startMin; m < endMin; m++) busyMinutes[m] = true;
      if (statusText === "Available all day (9 AM - 7 PM)") {
        statusText = "Repair Stage";
      } else if (!statusText.includes("Repair")) {
        statusText += `, Repair`;
      }
      continue;
    }

    if (cellVal > visitVal && cellVal < compVal) {
      for (let m = 0; m < 600; m++) busyMinutes[m] = true;
      statusText = `Busy: expected completion on ${formatDateLabel(rawCompDate)}`;
    } else if (cellVal === visitVal && cellVal === compVal) {
      if (rawCompTime) {
        const relMins = getRelativeMinutes(rawCompTime);
        for (let m = 0; m < relMins; m++) busyMinutes[m] = true;
        statusText = `Busy until ${formatTime12h(rawCompTime)}`;
      } else {
        for (let m = 0; m < 600; m++) busyMinutes[m] = true;
        isPendingTADA = true;
        statusText = "Busy (Times Pending)";
      }
    } else if (cellVal === visitVal && cellVal < compVal) {
      for (let m = 0; m < 600; m++) busyMinutes[m] = true;
      statusText = `Busy: starts today, expected completion ${formatDateLabel(rawCompDate)}`;
    } else if (cellVal === compVal && cellVal > visitVal) {
      if (rawCompTime) {
        const relMins = getRelativeMinutes(rawCompTime);
        for (let m = 0; m < relMins; m++) busyMinutes[m] = true;
        statusText = `Busy until ${formatTime12h(rawCompTime)}`;
      } else {
        for (let m = 0; m < 600; m++) busyMinutes[m] = true;
        isPendingTADA = true;
        statusText = "Busy (Times Pending)";
      }
    }
  }

  const segments = [];
  let currentType = busyMinutes[0];
  let start = 0;
  for (let i = 1; i <= 600; i++) {
    if (i === 600 || busyMinutes[i] !== currentType) {
      segments.push({
        type: currentType ? "busy" : "free",
        start,
        end: i,
        widthPercent: ((i - start) / 600) * 100,
      });
      if (i < 600) {
        currentType = busyMinutes[i];
        start = i;
      }
    }
  }

  return { segments, statusText, isPendingTADA };
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-100 rounded-lg shadow-lg text-xs space-y-1">
        <p className="font-bold text-slate-800">{label}</p>
        {payload.map((p, idx) => (
          <p key={idx} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.value} hrs
          </p>
        ))}
        <p className="text-[10px] text-slate-400 mt-1 border-t pt-1">
          Total Shift: 10 hrs (9 AM - 7 PM)
        </p>
      </div>
    );
  }
  return null;
};

// Today's availability chart for every engineer. Render it only while open: the busy/free
// segments are recomputed from the calendar history on every render.
export default function TodayAvailabilityModal({ onClose, masterData, calendarHistoryData }) {
  const engineersList = useMemo(() => {
    const masterEngs = masterData[0]?.["Engineer Assign Name"] || [];
    if (masterEngs.length > 0) return [...new Set(masterEngs)].sort();
    return [...new Set(calendarHistoryData.map((t) => t.engineerAssign).filter(Boolean))].sort();
  }, [masterData, calendarHistoryData]);

  const chartData = useMemo(() => {
    return engineersList.map((eng) => {
      const { segments, isPendingTADA } = getTodayAvailability(eng, calendarHistoryData);
      
      let busyHours = 0;
      let pendingHours = 0;
      let freeHours = 0;

      if (isPendingTADA) {
        pendingHours = 10;
      } else {
        segments.forEach((seg) => {
          const durationHrs = (seg.end - seg.start) / 60;
          if (seg.type === "busy") {
            busyHours += durationHrs;
          } else {
            freeHours += durationHrs;
          }
        });
      }

      return {
        name: eng,
        "Busy/Work Hours": parseFloat(busyHours.toFixed(1)),
        "Times Pending Hours": parseFloat(pendingHours.toFixed(1)),
        "Available Hours": parseFloat(freeHours.toFixed(1)),
      };
    });
  }, [engineersList, calendarHistoryData]);

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Today's Engineer Availability (9 AM - 7 PM)"
        size="3xl"
      >
        <div className="rounded-lg bg-card p-6 max-h-[80vh] overflow-y-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div className="text-sm text-muted-foreground">
              Availability view for today: <strong>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span> Busy</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> Times Pending</span>
            </div>
          </div>

          {/* Availability Stacked Bar Chart */}
          <div className="bg-muted/40 rounded-xl p-4 border border-border shadow-sm">
            <h4 className="text-xs font-bold text-foreground mb-2 px-1">Availability Breakdown (Hours)</h4>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600 }}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    stroke="#cbd5e1"
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    ticks={[0, 2, 4, 6, 8, 10]} 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    stroke="#cbd5e1"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Busy/Work Hours" stackId="availability" fill="#f43f5e" name="Busy/Work" />
                  <Bar dataKey="Times Pending Hours" stackId="availability" fill="#f59e0b" name="Times Pending" />
                  <Bar dataKey="Available Hours" stackId="availability" fill="#10b981" name="Available" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>


        </div>
      </Modal>
  );
}
