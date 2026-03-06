"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { generateApiKey } from "@/app/actions/api-keys";
import {
    Activity, Key, Globe, Plus, CheckCircle2,
    XCircle, Clock, Copy, Trash2, ShieldCheck, Loader2, X
} from "lucide-react";

type ApiKey = {
    id: string;
    name: string;
    prefix: string;
    status: string;
    created_at: string;
    last_used_at: string | null;
    created_by: string;
};

type Webhook = {
    id: string;
    name: string;
    url: string;
    event_type: string;
    is_active: boolean;
    created_at: string;
};

export default function IntegrationsPage() {
    const supabase = createClient();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState<'keys' | 'webhooks'>('keys');
    const [isLoading, setIsLoading] = useState(true);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);

    // Modal States
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [isCreatingKey, setIsCreatingKey] = useState(false);

    const [showWebhookModal, setShowWebhookModal] = useState(false);
    const [webhookForm, setWebhookForm] = useState({ name: "", url: "", event: "ORDER_SHIPPED", secret: "" });
    const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setIsLoading(true);
        await Promise.all([fetchApiKeys(), fetchWebhooks()]);
        setIsLoading(false);
    };

    const fetchApiKeys = async () => {
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setApiKeys(data);
        if (error) console.error(error);
    };

    const fetchWebhooks = async () => {
        const { data, error } = await supabase
            .from('webhook_endpoints')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setWebhooks(data);
        if (error) console.error(error);
    };

    const handleCreateApiKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        setIsCreatingKey(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            const result = await generateApiKey(newKeyName, `Bearer ${session.access_token}`);

            if (!result.success || !result.data) {
                throw new Error(result.error || "Failed to generate key");
            }

            setGeneratedToken(result.data.rawToken);
            toast.success("Key Generated", "Make sure to copy your API key now.");
            fetchApiKeys(); // Refresh list

        } catch (err: any) {
            toast.error("Error", err.message);
        } finally {
            setIsCreatingKey(false);
        }
    };

    const handleRevokeKey = async (id: string) => {
        if (!confirm("Are you sure you want to revoke this API key? Applications using it will instantly lose access.")) return;

        const { error } = await supabase.from('api_keys').update({ status: 'REVOKED' }).eq('id', id);
        if (error) toast.error("Error revoking key", error.message);
        else {
            toast.info("Key Revoked", "API key has been deactivated.");
            fetchApiKeys();
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied", "API Token copied to clipboard");
    };

    const handleCreateWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!webhookForm.name || !webhookForm.url) return;

        // basic URL validation
        try { new URL(webhookForm.url); } catch (_) {
            toast.warning("Invalid URL", "Please enter a valid HTTP/HTTPS URL");
            return;
        }

        setIsCreatingWebhook(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Auth error");

            const { error } = await supabase.from('webhook_endpoints').insert({
                name: webhookForm.name,
                url: webhookForm.url,
                event_type: webhookForm.event,
                secret: webhookForm.secret || null,
                created_by: user.id
            });

            if (error) throw error;
            toast.success("Webhook Added", "Outbound sync endpoint registered.");
            setShowWebhookModal(false);
            setWebhookForm({ name: "", url: "", event: "ORDER_SHIPPED", secret: "" });
            fetchWebhooks();

        } catch (e: any) {
            toast.error("Failed to add webhook", e.message);
        } finally {
            setIsCreatingWebhook(false);
        }
    };

    const toggleWebhook = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase.from('webhook_endpoints').update({ is_active: !currentStatus }).eq('id', id);
        if (error) toast.error("Failed to update status", error.message);
        else fetchWebhooks();
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Loading integration settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in pb-20 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <Activity className="w-6 h-6 text-primary-600" />
                    API & Integrations
                </h1>
                <p className="text-gray-500 text-sm mt-1">Manage inbound API keys and outbound webhooks for connecting E-commerce platforms.</p>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('keys')}
                    className={`py-3 px-6 inline-flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'keys'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Key className="w-4 h-4" />
                    API Keys (Inbound)
                </button>
                <button
                    onClick={() => setActiveTab('webhooks')}
                    className={`py-3 px-6 inline-flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'webhooks'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Globe className="w-4 h-4" />
                    Webhooks (Outbound)
                </button>
            </div>

            {/* --- API KEYS TAB --- */}
            {activeTab === 'keys' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div>
                            <h3 className="font-semibold text-gray-900">API Access Tokens</h3>
                            <p className="text-sm text-gray-500">Bearer tokens used to authenticate requests to WMS REST APIs (e.g., Creating Orders).</p>
                        </div>
                        <button
                            onClick={() => { setShowKeyModal(true); setGeneratedToken(null); setNewKeyName(""); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Generate Key
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4 text-left">Key Name</th>
                                    <th className="px-6 py-4 text-left">Token Prefix</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                    <th className="px-6 py-4 text-left">Last Used</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {apiKeys.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-12 text-gray-400">No API keys found. Let's create one.</td></tr>
                                ) : (
                                    apiKeys.map(key => (
                                        <tr key={key.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-gray-900">{key.name}</span>
                                                <div className="text-xs text-gray-400 mt-0.5">Created: {new Date(key.created_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-gray-500 text-xs">
                                                {key.prefix}••••••••
                                            </td>
                                            <td className="px-6 py-4">
                                                {key.status === 'ACTIVE' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 tracking-wider">
                                                        <CheckCircle2 className="w-3 h-3" /> ACTIVE
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 tracking-wider">
                                                        <XCircle className="w-3 h-3" /> REVOKED
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-xs">
                                                {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {key.status === 'ACTIVE' && (
                                                    <button onClick={() => handleRevokeKey(key.id)} className="text-red-600 hover:text-red-800 font-medium text-xs bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                                                        Revoke
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- WEBHOOKS TAB --- */}
            {activeTab === 'webhooks' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div>
                            <h3 className="font-semibold text-gray-900">Outbound Webhooks</h3>
                            <p className="text-sm text-gray-500">URLs that Colamarc WMS will `POST` to when automated events occur (e.g., Shipping).</p>
                        </div>
                        <button
                            onClick={() => setShowWebhookModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Endpoint
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {webhooks.length === 0 ? (
                            <div className="col-span-full bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
                                No webhooks registered. Click "Add Endpoint" to create one.
                            </div>
                        ) : (
                            webhooks.map(wh => (
                                <div key={wh.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-gray-900 tracking-tight">{wh.name}</h4>
                                        <button
                                            onClick={() => toggleWebhook(wh.id, wh.is_active)}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 transition-colors ${wh.is_active ? 'bg-primary-600' : 'bg-gray-200'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${wh.is_active ? 'translate-x-2' : '-translate-x-2'}`} />
                                        </button>
                                    </div>
                                    <div className="mb-4">
                                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-[10px] font-bold font-mono tracking-widest uppercase">
                                            {wh.event_type}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono break-all line-clamp-2" title={wh.url}>
                                        {wh.url}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}


            {/* === MODALS === */}

            {/* Generate API Key Modal */}
            {showKeyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !generatedToken && setShowKeyModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">
                                {generatedToken ? "Your New API Key" : "Generate API Key"}
                            </h3>
                            {!generatedToken && (
                                <button onClick={() => setShowKeyModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                            )}
                        </div>

                        <div className="px-6 py-5">
                            {generatedToken ? (
                                <div className="space-y-4">
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
                                        <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
                                        <div className="text-sm">
                                            <p className="font-bold mb-1">Save this token!</p>
                                            <p className="text-amber-700/80">For security reasons, this token will never be shown again. If you lose it, you must revoke the key and generate a new one.</p>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            readOnly
                                            value={generatedToken}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-3 pl-4 pr-12 text-sm font-mono text-gray-900"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(generatedToken)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white rounded-md transition-colors"
                                        >
                                            <Copy className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="pt-2">
                                        <button onClick={() => setShowKeyModal(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold">Done</button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleCreateApiKey} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Key Integration Name</label>
                                        <input
                                            type="text"
                                            value={newKeyName}
                                            onChange={(e) => setNewKeyName(e.target.value)}
                                            placeholder="e.g. Shopee Main Store"
                                            required
                                            className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 sm:text-sm"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button type="button" onClick={() => setShowKeyModal(false)} className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                        <button type="submit" disabled={isCreatingKey} className="flex px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50">
                                            {isCreatingKey ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Generate
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Webhook Modal */}
            {showWebhookModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowWebhookModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Add Webhook Endpoint</h3>
                            <button onClick={() => setShowWebhookModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreateWebhook} className="px-6 py-5 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Friendly Name</label>
                                <input
                                    type="text" value={webhookForm.name} onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                                    placeholder="e.g. ERP Update Callback" required
                                    className="w-full rounded-lg border-0 py-2.5 px-3 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target URL (POST)</label>
                                <input
                                    type="url" value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                                    placeholder="https://api.example.com/webhook" required
                                    className="w-full rounded-lg border-0 py-2.5 px-3 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 text-sm font-mono"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Trigger Event</label>
                                    <select
                                        value={webhookForm.event} onChange={(e) => setWebhookForm({ ...webhookForm, event: e.target.value })}
                                        className="w-full rounded-lg border-0 py-2.5 px-3 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 text-sm bg-white"
                                    >
                                        <option value="ORDER_SHIPPED">Order Shipped</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Secret (Optional)</label>
                                    <input
                                        type="text" value={webhookForm.secret} onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                                        placeholder="Signing secret..."
                                        className="w-full rounded-lg border-0 py-2.5 px-3 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowWebhookModal(false)} className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={isCreatingWebhook} className="flex px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50">
                                    {isCreatingWebhook ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Add Endpoint
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
