import { loginAction } from './actions'
import Image from 'next/image'
import { Mail, Lock, AlertCircle, Box, ArrowRight } from 'lucide-react'

// เพิ่มการรับ searchParams เพื่อนำข้อความ Error จาก URL มาแสดงผล
export default async function LoginPage(props: {
    searchParams: Promise<{ message?: string }>
}) {
    const searchParams = await props.searchParams;

    return (
        <div className="min-h-screen flex bg-white font-sans">
            {/* Left Side: Hero Image (Hidden on smaller screens) */}
            <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative bg-gray-900 overflow-hidden">
                <Image
                    src="/login-bg.png"
                    alt="Warehouse Automation"
                    fill
                    className="object-cover opacity-60 mix-blend-overlay"
                    priority
                />

                {/* Rich Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-gray-900/20" />

                <div className="absolute bottom-0 left-0 right-0 p-12 xl:p-16 text-white z-10">
                    <div className="flex items-center gap-3 mb-8 animate-in slide-in-from-bottom-4 duration-700">
                        <div className="bg-primary-500 p-2.5 rounded-xl shadow-lg shadow-primary-500/30">
                            <Box className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-white drop-shadow-md">
                            Colamarc WMS
                        </h2>
                    </div>
                    <div className="space-y-4 animate-in slide-in-from-bottom-6 duration-1000">
                        <p className="text-gray-300 text-lg xl:text-xl leading-relaxed max-w-xl font-medium">
                            Advanced Warehouse Management System.
                        </p>
                        <p className="text-gray-400 text-base leading-relaxed max-w-lg">
                            Optimize your inventory, track assets, and streamline operations with intelligent automation designed for modern enterprises.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 xl:px-32 bg-white relative z-10 lg:shadow-[-20px_0_30px_-10px_rgba(0,0,0,0.05)]">
                <div className="mx-auto w-full max-w-md">
                    {/* Mobile Header (Only visible when image is hidden) */}
                    <div className="lg:hidden mb-10 text-center flex flex-col items-center">
                        <div className="bg-primary-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border border-primary-100 shadow-sm">
                            <Box className="w-8 h-8 text-primary-600" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                            Colamarc WMS
                        </h2>
                        <p className="mt-2 text-gray-500 font-medium">Welcome back! Please login to your account.</p>
                    </div>

                    <div className="hidden lg:block mb-10">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                            Welcome Back
                        </h2>
                        <p className="mt-2 text-gray-500 font-medium text-lg">
                            Please enter your details to sign in.
                        </p>
                    </div>

                    <form className="space-y-6" action={loginAction}>
                        {/* Error Alert */}
                        {searchParams?.message && (
                            <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-red-800">Login Failed</h3>
                                    <p className="mt-1 text-sm text-red-600 font-medium">
                                        {searchParams.message}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                                    Email Address
                                </label>
                                <div className="mt-2 relative rounded-xl shadow-sm group">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" aria-hidden="true" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="Enter your email"
                                        required
                                        className="block w-full rounded-xl border-0 py-3.5 pl-11 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all duration-200 bg-gray-50 hover:bg-gray-100/50 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                                        Password
                                    </label>
                                    <div className="text-sm">
                                        <a href="#" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                                            Forgot password?
                                        </a>
                                    </div>
                                </div>
                                <div className="mt-2 relative rounded-xl shadow-sm group">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" aria-hidden="true" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        required
                                        className="block w-full rounded-xl border-0 py-3.5 pl-11 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all duration-200 bg-gray-50 hover:bg-gray-100/50 focus:bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                className="group flex w-full justify-center items-center gap-2 rounded-xl bg-primary-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all duration-200 active:scale-[0.98]"
                            >
                                Sign In
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </form>

                    <div className="mt-12 text-center">
                        <p className="text-sm text-gray-500 font-medium">
                            &copy; {new Date().getFullYear()} Colamarc Co., Ltd.<br className="sm:hidden" /> All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}