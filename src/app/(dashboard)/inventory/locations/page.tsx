"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, MapPin, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Location = {
    id: string;
    zone_name: string;
    bin_code: string;
    description: string;
};

export default function LocationsPage() {
    const supabase = createClient();
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
            alert(`Error saving location: ${error.message}`);
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
            alert(`Error deleting location: ${error.message}`);
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-primary-600" />
                        Location Master
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage your warehouse zones and storage bins.
                    </p>
                </div>
                {(userRole === 'superadmin' || userRole === 'sup') && (
                    <div className="mt-4 sm:ml-4 sm:mt-0">
                        <button
                            type="button"
                            onClick={() => openModal('add')}
                            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 transition-colors"
                        >
                            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                            Add New Location
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm ring-1 ring-border-light overflow-hidden">
                <div className="p-4 border-b border-border-light flex items-center justify-between">
                    <div className="relative rounded-md shadow-sm max-w-sm w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-md border-0 py-2 pl-10 text-foreground ring-1 ring-inset ring-border-light placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Search by Zone or Bin..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border-light">
                        <thead className="bg-surface">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                                    Zone Name
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                                    Bin Code
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                                    Description
                                </th>
                                {(userRole === 'superadmin' || userRole === 'sup') && (
                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="py-10 text-center text-sm text-gray-500">
                                        Loading locations...
                                    </td>
                                </tr>
                            ) : filteredLocations.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-10 text-center text-sm text-gray-500">
                                        No locations found.
                                    </td>
                                </tr>
                            ) : (
                                filteredLocations.map((location) => (
                                    <tr key={location.id} className="hover:bg-surface-hover transition-colors">
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                                            {location.zone_name}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            <span className="inline-flex items-center rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-600/20">
                                                {location.bin_code}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {location.description || "-"}
                                        </td>
                                        {(userRole === 'superadmin' || userRole === 'sup') && (
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                <button
                                                    onClick={() => openModal('edit', location)}
                                                    className="text-primary-600 hover:text-primary-900 mr-4 transition-colors"
                                                >
                                                    <Edit2 className="h-4 w-4 inline" />
                                                </button>
                                                {userRole === 'superadmin' && (
                                                    <button
                                                        onClick={() => handleDelete(location.id, location.bin_code)}
                                                        className="text-red-600 hover:text-red-900 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4 inline" />
                                                    </button>
                                                )}
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
                    <div className="fixed inset-0 bg-gray-900/50 transition-opacity" onClick={() => setIsModalOpen(false)} />
                    <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
                        <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-semibold leading-6 text-foreground">
                                    {modalMode === 'add' ? 'Add New Location' : 'Edit Location'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSave}>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="zone_name" className="block text-sm font-medium leading-6 text-foreground">Zone Name *</label>
                                        <input
                                            type="text"
                                            id="zone_name"
                                            required
                                            className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                            value={currentLocation.zone_name || ''}
                                            onChange={(e) => setCurrentLocation({ ...currentLocation, zone_name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="bin_code" className="block text-sm font-medium leading-6 text-foreground">Bin Code *</label>
                                        <input
                                            type="text"
                                            id="bin_code"
                                            required
                                            className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                            value={currentLocation.bin_code || ''}
                                            onChange={(e) => setCurrentLocation({ ...currentLocation, bin_code: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="description" className="block text-sm font-medium leading-6 text-foreground">Description</label>
                                        <input
                                            type="text"
                                            id="description"
                                            className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                            value={currentLocation.description || ''}
                                            onChange={(e) => setCurrentLocation({ ...currentLocation, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 sm:ml-3 sm:w-auto transition-colors"
                                    >
                                        {isSubmitting ? 'Saving...' : 'Save Location'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border-light hover:bg-surface-hover sm:mt-0 sm:w-auto transition-colors"
                                    >
                                        Cancel
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
