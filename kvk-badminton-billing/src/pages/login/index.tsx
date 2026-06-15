import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, LogIn, Dumbbell, X, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate } from 'react-router-dom'
import { login } from '@/services/auth-api'
import Alert from '@/components/ui/alert'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [pageAlert, setPageAlert] = useState<{ visible: boolean; variant?: 'success' | 'error' | 'warning' | 'info'; title?: string; description?: string }>({ visible: false });

  const navigate = useNavigate()

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    try {
      // Simulate API call - replace with actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 1500))
      setForgotSuccess(true)
      setTimeout(() => {
        setShowForgotModal(false)
        setForgotSuccess(false)
        setForgotEmail('')
      }, 2500)
    } catch (error) {
      setPageAlert({ visible: true, variant: 'error', title: 'Error', description: 'Failed to send reset request.' })
    } finally {
      setForgotLoading(false)
    }
  }

  const closeForgotModal = () => {
    setShowForgotModal(false)
    setForgotEmail('')
    setForgotSuccess(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true)
    try {
      const cashier = await login(formData.userId, formData.password);
      localStorage.setItem('cashier', JSON.stringify(cashier));
      navigate('/members')
    } catch (error) {
      setPageAlert({ visible: true, variant: 'error', title: 'Login Failed', description: 'Invalid user ID or password.' });
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating circles - Right side */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-morph"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-morph" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: '1s' }}></div>

        {/* Floating circles - Left side (visible) */}
        <div className="absolute -top-20 left-10 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl animate-morph" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: '2.5s' }}></div>
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-morph" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* Main container */}
      <div className="relative z-10 h-screen w-screen flex overflow-hidden">
        {/* Left side - Branding section (hidden on mobile) */}
        <div className="hidden md:flex md:w-2/5 flex-col justify-center items-start px-12 lg:px-20 overflow-hidden">
          <div className="max-w-md animate-fade-in max-h-screen overflow-y-auto pr-2">
            {/* Logo and title */}
            <div className="mb-12 flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-110 cursor-pointer">
                <Dumbbell className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">KVK Gym</h1>
                <p className="text-blue-400 font-semibold mt-1">Premium Fitness</p>
              </div>
            </div>

            {/* Hero content */}
            <div className="space-y-8">
              <div>
                <h2 className="text-4xl font-bold text-white leading-tight mb-6">
                  Manage Your Gym Empire
                </h2>
                <p className="text-lg text-gray-300 leading-relaxed">
                  Streamline member management, billing, and gym operations with our premium admin dashboard.
                </p>
              </div>

              {/* Features list */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-blue-400 font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">Real-time Member Analytics</p>
                    <p className="text-sm text-gray-400 mt-1">Track memberships and engagement</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-blue-400 font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">Automated Billing System</p>
                    <p className="text-sm text-gray-400 mt-1">Secure payment processing</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-blue-400 font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">Advanced Reporting</p>
                    <p className="text-sm text-gray-400 mt-1">Data-driven insights</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom accent */}
            <div className="mt-16 pt-8 border-t border-white/10">
              <p className="text-sm text-gray-400">
                Developed by <span className="font-semibold text-white">2D-Coders</span> | &copy; 2026 KVK Gym. All rights reserved.
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="w-full md:w-3/5 flex flex-col justify-center items-center px-4 py-0 md:px-12 lg:px-20 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          {pageAlert.visible && (
            <div>
              <Alert variant={pageAlert.variant as any} title={pageAlert.title} description={pageAlert.description} onClose={() => setPageAlert((s) => ({ ...s, visible: false }))} />
            </div>
          )}
          <div className="w-full max-w-md animate-slide-up overflow-y-auto max-h-screen md:max-h-none">
            {/* White card */}
            <div className="bg-white border border-gray-200 rounded-3xl shadow-md p-8 md:p-10 transition-all duration-500 hover:shadow-l hover:border-gray-300 backdrop-blur-sm">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 md:hidden mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
                    <Dumbbell className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="font-bold text-lg text-gray-900">KVK Gym</span>
                </div>
                <h2 className="text-3xl md:text-3xl font-bold text-gray-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-600 font-medium">
                  Admin Management Portal
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* User ID field */}
                <div className="space-y-2">
                  <Label htmlFor="userId" className="text-gray-700 font-semibold text-sm">
                    User ID
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input
                      id="userId"
                      name="userId"
                      type="text"
                      placeholder="Enter your user ID"
                      value={formData.userId}
                      onChange={handleChange}
                      className="pl-10 pr-4 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300 placeholder:text-gray-400 h-9 text-gray-900 hover:border-gray-400"
                      required
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-semibold text-sm">
                    Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 pr-10 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300 placeholder:text-gray-400 h-9 text-gray-900 hover:border-gray-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors duration-300 hover:scale-110 p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 transition-transform duration-300" />
                      ) : (
                        <Eye className="w-4 h-4 transition-transform duration-300" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot password link */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-blue-600 cursor-pointer hover:text-blue-700 font-medium text-xs transition-colors">
                    Forgot password?
                  </button>
                </div>

                {/* Login button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 mt-6 bg-gradient-to-r cursor-pointer from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 group text-sm active:scale-95 active:shadow-md"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Signing In...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300 cursor-pointer" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-600">
                  Don't have access?{' '}
                  <a href="#" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                    Contact admin
                  </a>
                </p>
              </div>
            </div>

            {/* Security info */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Your data is secure and encrypted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Reset Password</h3>
                <p className="text-blue-100 text-sm mt-1">Request password reset from super admin</p>
              </div>
              <button
                onClick={closeForgotModal}
                className="text-white cursor-pointer hover:bg-blue-500/30 p-2 rounded-lg transition-all duration-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {!forgotSuccess ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="forgotEmail" className="text-gray-700 font-semibold text-sm mb-2 block">
                      Email or User ID
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      <Input
                        id="forgotEmail"
                        type="text"
                        placeholder="Enter your email or user ID"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-10 pr-4 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300 placeholder:text-gray-400 h-10 text-gray-900"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      We'll send a password reset link to your registered email address.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full h-10 cursor-pointer bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                    >
                      {forgotLoading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          Send Reset Request
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="w-full h-10 cursor-pointer border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-300 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4 animate-bounce-soft">
                    <CheckCircle size={32} className="text-emerald-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Request Sent!</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Your password reset request has been sent to the super admin. You'll receive an email shortly with reset instructions.
                  </p>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                    Check your email inbox and spam folder for the reset link.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}