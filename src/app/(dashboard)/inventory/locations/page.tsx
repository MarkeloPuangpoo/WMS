"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, MapPin, X, Inbox, Loader2, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

type Location = {
    id: string;
    zone_name: string;
    bin_code: string;
    description: string;
};

export default function LocationsPage() {
    const supabase = createClient();
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentLocation, setCurrentLocation] = useState<Partial<Location>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // RBAC
    const [userRole, setUserRole] = useState<string>("user");

    useEffect(() => {
        fetchLocations();
        checkUserRole();
    }, []);

    const checkUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
            if (data) setUserRole(data.role);
        }
    };

    const fetchLocations = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .order('zone_name', { ascending: true })
            .order('bin_code', { ascending: true });

        if (!error && data) {
            setLocations(data);
        }
        setIsLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (modalMode === 'add') {
                const { error } = await supabase.from('locations').insert([
                    {
                        zone_name: currentLocation.zone_name,
                        bin_code: currentLocation.bin_code,
                        description: currentLocation.description
                    }
                ]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('locations').update({
                    zone_name: currentLocation.zone_name,
                    bin_code: currentLocation.bin_code,
                    description: currentLocation.description
                }).eq('id', currentLocation.id);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchLocations();
        } catch (error: any) {
            toast.error("Save Failed", error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, bin_code: string) => {
        if (!confirm(`Are you sure you want to delete bin ${bin_code}?`)) return;

        try {
            const { error } = await supabase.from('locations').delete().eq('id', id);
            if (error) throw error;
            fetchLocations();
        } catch (error: any) {
            toast.error("Delete Failed", error.message);
        }
    };

    const openModal = (mode: 'add' | 'edit', location?: Location) => {
        setModalMode(mode);
        setCurrentLocation(location || { zone_name: '', bin_code: '', description: '' });
        setIsModalOpen(true);
    };

    const filteredLocations = locations.filter(loc =>
        loc.zone_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.bin_code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
                        <div className="p-2 bg-primary-50 rounded-lg">
                            <MapPin className="h-6 w-6 text-primary-600" />
                        </div>
                        Location Master
                    </h1>
                    <p className="mt-1.5 text-sm text-gray-500">
                        Manage your warehouse zones and specific storage bins.
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                    <Link
                        href="/inventory/locations/labels"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 transition-all focus:ring-2 focus:ring-gray-200 focus:ring-offset-2"
                    >
                        <QrCode className="-ml-1 mr-2 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Print Labels
                    </Link>
                    {(userRole === 'superadmin' || userRole === 'sup') && (
                        <button
                            type="button"
                            onClick={() => openModal('add')}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-all focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            Add Location
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Toolbar */}
                <div className="p-5 border-b border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative max-w-md w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Search by Zone or Bin..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="text-sm text-gray-500 font-medium">
                        Total {filteredLocations.length} locations
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Zone Name
                                </th>
                                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Bin Code
                                </th>
                                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Description
                                </th>
                                {(userRole === 'superadmin' || userRole === 'sup') && (
                                    <th scope="col" className="relative py-4 pl-3 pr-6 text-right">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center">
                                        <Loader2 className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-3" />
                                        <p className="text-sm text-gray-500 font-medium">Loading locations...</p>
                                    </td>
                                </tr>
                            ) : filteredLocations.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center">
                                        <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <Inbox className="h-8 w-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-900">No locations found</h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {searchQuery ? "Try adjusting your search query." : "Get started by creating a new location."}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLocations.map((location) => (
                                    <tr key={location.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                                            {location.zone_name}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                            <span className="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-600/20">
                                                {location.bin_code}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {location.description || <span className="text-gray-300 italic">No description</span>}
                                        </td>
                                        {(userRole === 'superadmin' || userRole === 'sup') && (
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openModal('edit', location)}
                                                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    {userRole === 'superadmin' && (
                                                        <button
                                                            onClick={() => handleDelete(location.id, location.bin_code)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
                    <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:w-full sm:max-w-lg">
                        <div className="bg-white px-6 pb-6 pt-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-gray-900">
                                    {modalMode === 'add' ? 'Add New Location' : 'Edit Location'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-1 rounded-full transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSave}>
                                <div className="space-y-5">
                                    <div>
                                        <label htmlFor="zone_name" className="block text-sm font-semibold text-gray-700">Zone Name <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            id="zone_name"
                                            required
                                            className="mt-1.5 block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                                            placeholder="e.g. Zone A"
                                            value={currentLocation.zone_name || ''}
                                            onChange={(e) => setCurrentLocation({ ...currentLocation, zone_name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="bin_code" className="block text-sm font-semibold text-gray-700">Bin Code <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            id="bin_code"
                                            required
                                            className="mt-1.5 block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                                            placeholder="e.g. A-01-01"
                                            value={currentLocation.bin_code || ''}
                                            onChange={(e) => setCurrentLocation({ ...currentLocation, bin_code: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="description" className="block text-sm font-semibold text-gray-700">Description</label>
                                        <textarea
                                            id="description"
                                            rows={3}
                                            className="mt-1.5 block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all resize-none"
                                            placeholder="Optional details about this location..."
                                            value={currentLocation.description || ''}
                                            onChange={(e) => setCurrentLocation({ ...currentLocation, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex w-full justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 sm:w-auto transition-colors"
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                                            </span>
                                        ) : (
                                            'Save Location'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}