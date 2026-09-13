import Alert from '@/components/ui/alert';
import { changePassword } from '@/services/auth-api';
import { ArrowRight, Loader2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
    const [pageAlert, setPageAlert] = useState<{ visible: boolean; variant?: 'success' | 'error' | 'warning' | 'info'; title?: string; description?: string }>({ visible: false });
    const cashier = localStorage.getItem('cashier') ? JSON.parse(localStorage.getItem('cashier') as string) : null;
    const [fullName, setFullName] = useState(cashier ? cashier.firstName + ' ' + cashier.lastName : 'Admin User');
    const [email, setEmail] = useState(cashier ? cashier.email : 'admin@kvkgym.com');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const dayendData = localStorage.getItem("dayEndData") ? JSON.parse(localStorage.getItem("dayEndData") as string) : null;

    useEffect(() => {
        if (!dayendData) {
            navigate("/dayend");
        }
    }, [dayendData]);

    const handleChangePassword = async () => {

        if (newPassword !== confirmPassword) {
            setPageAlert({
                visible: true,
                variant: 'error',
                title: 'Password mismatch',
                description: 'New password and confirm password do not match. Please check and try again.'
            })
            return
        }

        setLoading(true)
        try {
            const body = {
                userId: cashier.userId,
                userName: cashier.userName,
                currentPassword,
                newPassword
            }

            await changePassword(body);
            setPageAlert({
                visible: true,
                variant: 'success',
                title: 'Update Password',
                description: 'The password has been successfully updated.'
            })
        } catch (error: any) {
            setPageAlert({
                visible: true,
                variant: 'error',
                title: 'Update password failed!',
                description: error.response.data.message || 'An error occurred while updating the password. Please try again.'
            });
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            {pageAlert.visible && (
                <div>
                    <Alert variant={pageAlert.variant as any} title={pageAlert.title} description={pageAlert.description} onClose={() => setPageAlert((s) => ({ ...s, visible: false }))} />
                </div>
            )}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl md:text-3xl font-semibold text-gray-900">Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your account, preferences and security</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                {/* Left column - Profile & Notifications */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex gap-6">

                            <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-700 mb-1.5">Full name</label>
                                        <input value={fullName} onChange={(e) => setFullName(e.target.value)} readOnly className="w-full px-3 py-1 border rounded-md" />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-700 mb-1.5">Email</label>
                                        <input value={email} onChange={(e) => setEmail(e.target.value)} readOnly className="w-full px-3 py-1 border rounded-md" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right column - Security, Billing, Danger */}
                <div className="space-y-6">
                    <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <Lock size={20} className="text-gray-700" />
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Security</h2>
                                    <p className="text-sm text-gray-500">Change your password and manage access</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-gray-700 mb-1.5">Current password</label>
                                    <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" className="w-full px-3 py-1 border rounded-md" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-1.5">New password</label>
                                    <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" className="w-full px-3 py-1 border rounded-md" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-700 mb-1.5">Confirm password</label>
                                <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" className="w-full px-3 py-1 border rounded-md" />
                            </div>
                            <div className="flex justify-end">
                                <button disabled={!currentPassword && !newPassword && !confirmPassword} onClick={handleChangePassword} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-amber-700">
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                    {loading ? "Updating" : "Change Password"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
