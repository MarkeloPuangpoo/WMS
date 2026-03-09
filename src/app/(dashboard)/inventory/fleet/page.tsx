"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import {
    Truck,
    User,
    Plus,
    Loader2,
    ShieldAlert,
    FileEdit,
    Trash2
} from "lucide-react";

type Vehicle = {
    id: string;
    license_plate: string;
    type: string;
    capacity: string;
    status: string;
};

type Driver = {
    id: string;
    name: string;
    phone: string;
    status: string;
};

export default function FleetManagementPage() {
    const supabase = createClient();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState<'drivers' | 'vehicles'>('drivers');
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [showDriverModal, setShowDriverModal] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [driverForm, setDriverForm] = useState({ name: '', phone: '' });
    const [vehicleForm, setVehicleForm] = useState({ license_plate: '', type: 'Truck', capacity: '' });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const [vRes, dRes] = await Promise.all([
                supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
                supabase.from('drivers').select('*').order('created_at', { ascending: false })
            ]);

            if (vRes.error) throw vRes.error;
            if (dRes.error) throw dRes.error;

            setVehicles(vRes.data || []);
            setDrivers(dRes.data || []);
        } catch (error: any) {
            console.error("Fetch error:", error);
            // Ignore missing table error if they haven't run the script
            if (error.code !== '42P01') {
                toast.error("Error loading data", error.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('drivers').insert([driverForm]);
            if (error) throw error;
            toast.success("Driver Added", "New driver has been registered.");
            setShowDriverModal(false);
            setDriverForm({ name: '', phone: '' });
            fetchSettings();
        } catch (error: any) {
            toast.error("Failed to add driver", error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('vehicles').insert([vehicleForm]);
            if (error) throw error;
            toast.success("Vehicle Added", "New vehicle has been registered.");
            setShowVehicleModal(false);
            setVehicleForm({ license_plate: '', type: 'Truck', capacity: '' });
            fetchSettings();
        } catch (error: any) {
            toast.error("Failed to add vehicle", error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStatus = async (table: 'drivers' | 'vehicles', id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            toast.success("Status Updated", `Changed to ${newStatus}`);
            fetchSettings();
        } catch (error: any) {
            toast.error("Failed to update status", error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <Truck className="w-6 h-6 text-primary-600" />
                    Fleet Resources
                </h1>
                <p className="text-gray-500 text-sm mt-1">Manage delivery vehicles and drivers.</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-1 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('drivers')}
                    className={`py-3 px-6 inline-flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'drivers'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <User className="w-4 h-4" />
                    Drivers ({drivers.length})
                </button>
                <button
                    onClick={() => setActiveTab('vehicles')}
                    className={`py-3 px-6 inline-flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'vehicles'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Truck className="w-4 h-4" />
                    Vehicles ({vehicles.length})
                </button>
            </div>

            {/* TAB CONTENT: DRIVERS */}
            {activeTab === 'drivers' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center bg-gray-50 p-4 border border-gray-100 rounded-xl">
                        <p className="text-sm text-gray-600">List of all drivers available for task dispatch.</p>
                        <button
                            onClick={() => setShowDriverModal(true)}
                            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary-700"
                        >
                            <Plus className="w-4 h-4" /> Add Driver
                        </button>
                    </div>

                    <div className="bg-white border text-sm max-w-4xl border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {isLoading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                        ) : drivers.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No drivers configured yet.</div>
                        ) : (
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Name</th>
                                        <th className="px-6 py-3 font-semibold">Phone Contact</th>
                                        <th className="px-6 py-3 font-semibold">Status</th>
                                        <th className="px-6 py-3 text-right font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {drivers.map(driver => (
                                        <tr key={driver.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-3 font-medium text-gray-900">{driver.name}</td>
                                            <td className="px-6 py-3 text-gray-600">{driver.phone || '-'}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${driver.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {driver.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button
                                                    onClick={() => toggleStatus('drivers', driver.id, driver.status)}
                                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md"
                                                >
                                                    Toggle Status
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: VEHICLES */}
            {activeTab === 'vehicles' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center bg-gray-50 p-4 border border-gray-100 rounded-xl">
                        <p className="text-sm text-gray-600">Company vehicles mapped to drivers for deliveries.</p>
                        <button
                            onClick={() => setShowVehicleModal(true)}
                            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary-700"
                        >
                            <Plus className="w-4 h-4" /> Add Vehicle
                        </button>
                    </div>

                    <div className="bg-white border text-sm max-w-4xl border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {isLoading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                        ) : vehicles.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No vehicles configured yet.</div>
                        ) : (
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">License Plate</th>
                                        <th className="px-6 py-3 font-semibold">Type</th>
                                        <th className="px-6 py-3 font-semibold">Capacity</th>
                                        <th className="px-6 py-3 font-semibold">Status</th>
                                        <th className="px-6 py-3 text-right font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {vehicles.map(v => (
                                        <tr key={v.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-3 font-bold text-gray-900">{v.license_plate}</td>
                                            <td className="px-6 py-3 text-gray-600">{v.type}</td>
                                            <td className="px-6 py-3 text-gray-600">{v.capacity || '-'}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {v.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button
                                                    onClick={() => toggleStatus('vehicles', v.id, v.status)}
                                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md"
                                                >
                                                    Toggle Status
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* DRIVER MODAL */}
            {showDriverModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-900">Add New Driver</h3>
                        </div>
                        <form onSubmit={handleCreateDriver} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text" required
                                    value={driverForm.name}
                                    onChange={e => setDriverForm({ ...driverForm, name: e.target.value })}
                                    placeholder="e.g. John Doe"
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <input
                                    type="text" required
                                    value={driverForm.phone}
                                    onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })}
                                    placeholder="e.g. 081-234-5678"
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowDriverModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Driver"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VEHICLE MODAL */}
            {showVehicleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-900">Add New Vehicle</h3>
                        </div>
                        <form onSubmit={handleCreateVehicle} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                                <input
                                    type="text" required
                                    value={vehicleForm.license_plate}
                                    onChange={e => setVehicleForm({ ...vehicleForm, license_plate: e.target.value.toUpperCase() })}
                                    placeholder="e.g. 1กข-1234"
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none uppercase"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                                <select
                                    value={vehicleForm.type}
                                    onChange={e => setVehicleForm({ ...vehicleForm, type: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                >
                                    <option>Truck (4 Wheels)</option>
                                    <option>Truck (6 Wheels)</option>
                                    <option>Van</option>
                                    <option>Motorcycle</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (Optional)</label>
                                <input
                                    type="text"
                                    value={vehicleForm.capacity}
                                    onChange={e => setVehicleForm({ ...vehicleForm, capacity: e.target.value })}
                                    placeholder="e.g. 1000kg or 200 boxes"
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowVehicleModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Vehicle"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
