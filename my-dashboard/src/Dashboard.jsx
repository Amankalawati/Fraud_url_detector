import { useState } from 'react';
import {
  Menu,
  X,
  Bell,
  Search,
  User,
  Send,
  Home,
  BarChart3,
  Settings,
} from 'lucide-react';

const Dashboard = () => {
  const [text, setText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false); // Closed by default on mobile
  const [mobileBottomNav, setMobileBottomNav] = useState('messages');

  const handleSubmit = () => {
    if (text.trim()) {
      alert('Message sent: ' + text);
      setText('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Mobile Top Bar */}
      <header className="lg:hidden bg-gray-900 border-b border-purple-900 px-4 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
        <button onClick={() => setSidebarOpen(true)} className="text-pink-400">
          <Menu size={28} />
        </button>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
          <User size={20} />
        </div>
      </header>

      {/* Sidebar (Desktop + Mobile Overlay) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-purple-800 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center font-bold text-xl">
              D
            </div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-pink-400">
            <X size={28} />
          </button>
        </div>

        <nav className="mt-8 px-4">
          {[
            { label: 'Overview', icon: Home, id: 'overview' },
            { label: 'Messages', icon: Send, id: 'messages', active: true },
            { label: 'Analytics', icon: BarChart3, id: 'analytics' },
            { label: 'Settings', icon: Settings, id: 'settings' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileBottomNav(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex items-center px-4 py-3 mb-2 rounded-lg transition ${
                  item.active
                    ? 'bg-purple-800 text-pink-400 border border-pink-500'
                    : 'text-gray-300 hover:bg-purple-900 hover:text-pink-400'
                }`}
              >
                <Icon size={20} className="mr-4" />
                <span className="font-medium">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Desktop Top Navbar */}
        <header className="hidden lg:flex bg-gray-900 border-b border-purple-900 px-8 py-5 items-center justify-between">
          <div className="flex items-center space-x-6">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-pink-400">
              <Menu size={28} />
            </button>
            <div className="relative">
              <Search className="absolute left-4 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search..."
                className="pl-12 pr-6 py-3 bg-gray-800 border border-purple-700 rounded-xl focus:outline-none focus:border-pink-500 text-white placeholder-gray-500 w-80"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <button className="relative text-gray-300 hover:text-pink-400">
              <Bell size={26} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full animate-pulse"></span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center">
                <User size={22} />
              </div>
              <span className="font-semibold">John Doe</span>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 p-6 pt-20 lg:pt-8 lg:p-10">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl lg:text-4xl font-bold mb-8 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              Send a New Message
            </h2>

            {/* Message Card */}
            <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 lg:p-10 border border-purple-800">
              <label className="block text-sm font-semibold text-gray-300 mb-4">
                Message
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your message here..."
                className="w-full h-56 lg:h-64 px-6 py-5 bg-gray-800 border border-purple-700 rounded-xl 
                         focus:outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-900/30 
                         resize-none text-white placeholder-gray-500 text-base"
              />

              <div className="mt-6 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
                <p className="text-sm text-gray-400">{text.length} / 2000 characters</p>
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                  className={`flex items-center space-x-3 px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200
                    ${text.trim()
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-xl hover:shadow-2xl transform hover:-translate-y-1'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <Send size={22} />
                  <span>Send Message</span>
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10">
              {[
                { label: 'Total Messages', value: '1,245', icon: Send },
                { label: 'Pending', value: '23', icon: Bell },
                { label: 'Success Rate', value: '98.2%', icon: BarChart3 },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="bg-gray-900 rounded-xl p-6 text-center border border-purple-800 hover:border-pink-600 transition"
                  >
                    <Icon size={32} className="mx-auto mb-3 text-pink-400" />
                    <p className="text-gray-400 text-sm">{stat.label}</p>
                    <p className="text-3xl font-bold mt-2">{stat.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-purple-900 px-4 py-3 z-50">
          <div className="flex justify-around">
            {[
              { id: 'overview', icon: Home, label: 'Home' },
              { id: 'messages', icon: Send, label: 'Messages' },
              { id: 'analytics', icon: BarChart3, label: 'Stats' },
              { id: 'settings', icon: Settings, label: 'Settings' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setMobileBottomNav(item.id)}
                  className={`flex flex-col items-center p-3 rounded-xl transition ${
                    mobileBottomNav === item.id
                      ? 'text-pink-400 bg-purple-800'
                      : 'text-gray-400'
                  }`}
                >
                  <Icon size={24} />
                  <span className="text-xs mt-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Dashboard;