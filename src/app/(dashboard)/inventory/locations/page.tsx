"use client";

import { useState } from "react";
import { Plus, Search, Edit2, Trash2, MapPin } from "lucide-react";

type Location = {
    id: string;
    zone_name: string;
    bin_code: string;
    description: string;
};

export default function LocationsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    // Mock Data for Layout building
    const [locations, setLocations] = useState<Location[]>([
        { id: "1", zone_name: "Zone A", bin_code: "A-01-01", description: "Fast moving goods" },
        { id: "2", zone_name: "Zone A", bin_code: "A-01-02", description: "Fast moving goods" },
        { id: "3", zone_name: "Zone B", bin_code: "B-01-01", description: "Heavy items" },
    ]);

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
                <div className="mt-4 sm:ml-4 sm:mt-0">
                    <button
                        type="button"
                        className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
                    >
                        <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                        Add New Location
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm ring-1 ring-border-light overflow-hidden">
                <div className="p-4 border-b border-border-light flex items-center justify-between">
                    <div className="relative rounded-md shadow-sm max-w-sm w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            name="search"
                            id="search"
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
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light bg-white">
                            {locations.map((location) => (
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
                                        {location.description}
                                    </td>
                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                        <button className="text-primary-600 hover:text-primary-900 mr-4 transition-colors">
                                            <Edit2 className="h-4 w-4 inline" />
                                            <span className="sr-only">Edit {location.bin_code}</span>
                                        </button>
                                        <button className="text-red-600 hover:text-red-900 transition-colors">
                                            <Trash2 className="h-4 w-4 inline" />
                                            <span className="sr-only">Delete {location.bin_code}</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {locations.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-10 text-center text-sm text-gray-500">
                                        No locations found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
