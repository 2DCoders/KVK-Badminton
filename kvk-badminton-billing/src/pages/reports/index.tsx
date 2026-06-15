import { Download, Calendar } from 'lucide-react';

export default function Reports() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Reports</h2>
          <p className="text-gray-600 mt-1">Generate and view analytics</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium">
          <Download size={20} />
          Generate Report
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-xs bg-white/80 backdrop-blur-md rounded-lg border border-gray-200 px-4 py-2 flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <input type="date" className="bg-transparent outline-none w-full" />
        </div>
        <div className="flex-1 min-w-xs bg-white/80 backdrop-blur-md rounded-lg border border-gray-200 px-4 py-2 flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <input type="date" className="bg-transparent outline-none w-full" />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Members', value: '1,234', change: '+12%', icon: '👥' },
          { label: 'New Members', value: '87', change: '+23%', icon: '➕' },
          { label: 'Avg Attendance', value: '87%', change: '+2.1%', icon: '📊' },
          { label: 'Revenue', value: '$42.5K', change: '+8.2%', icon: '💰' },
        ].map((metric, i) => (
          <div key={i} className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium">{metric.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{metric.value}</p>
              </div>
              <span className="text-3xl">{metric.icon}</span>
            </div>
            <p className="text-xs text-emerald-600 font-semibold">{metric.change} vs last period</p>
          </div>
        ))}
      </div>

      {/* Chart Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-end justify-around gap-2">
            {[45, 60, 50, 75, 65, 80, 70].map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-primary to-blue-400 rounded-t-lg"
                style={{ height: `${v}%`, opacity: 0.6 + (v / 100) * 0.4 }}
              />
            ))}
          </div>
        </div>

        {/* Member Growth */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Member Growth</h3>
          <div className="space-y-4">
            {[
              { label: 'Premium', value: 450, color: 'from-blue-500 to-blue-400' },
              { label: 'Standard', value: 580, color: 'from-purple-500 to-purple-400' },
              { label: 'Basic', value: 204, color: 'from-emerald-500 to-emerald-400' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  <span className="text-sm font-bold text-gray-900">{item.value}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`bg-gradient-to-r ${item.color} h-full rounded-full`}
                    style={{ width: `${(item.value / 580) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Export Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['PDF', 'Excel', 'CSV'].map((format, i) => (
            <button
              key={i}
              className="px-4 py-3 bg-light-gray hover:bg-gray-300 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Export as {format}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
