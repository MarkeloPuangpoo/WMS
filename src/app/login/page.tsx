import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// เพิ่มการรับ searchParams เพื่อนำข้อความ Error จาก URL มาแสดงผล
export default async function LoginPage(props: {
    searchParams: Promise<{ message?: string }>
}) {
    const searchParams = await props.searchParams;

    // Server Action สำหรับจัดการการล็อกอิน
    const login = async (formData: FormData) => {
        'use server'

        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const supabase = await createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        // ถ้าเข้าสู่ระบบไม่สำเร็จ ให้ส่งกลับมาหน้าเดิมพร้อมข้อความแจ้งเตือน
        if (error) {
            return redirect('/login?message=อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
        }

        // ล็อกอินสำเร็จ ส่งผู้ใช้ไปที่หน้า Dashboard หรือหน้าแรก
        return redirect('/')
    }

    return (
        <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-surface">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-primary-600">
                    colamarc WMS
                </h2>
                <h3 className="mt-2 text-center text-sm text-gray-500">
                    Login to your accout
                </h3>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                <form className="space-y-6" action={login}>

                    {/* แสดงกล่องข้อความแจ้งเตือนเมื่อมี Error */}
                    {searchParams?.message && (
                        <div className="rounded-md bg-red-50 p-4 border border-red-200">
                            <p className="text-sm text-red-600 text-center font-medium">
                                {searchParams.message}
                            </p>
                        </div>
                    )}

                    <div>
                        {/* เพิ่ม htmlFor เพื่อเชื่อมกับ input id */}
                        <label htmlFor="email" className="block text-sm font-medium leading-6 text-foreground">
                            Email address
                        </label>
                        <div className="mt-2">
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="you@example.com"
                                required
                                className="block w-full rounded-md border-0 py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border-light placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="password" className="block text-sm font-medium leading-6 text-foreground">
                                Password
                            </label>
                            <div className="text-sm">
                                <a href="/forgot-password" className="font-semibold text-primary-600 hover:text-primary-500 transition-colors">
                                    Forgot password
                                </a>
                            </div>
                        </div>
                        <div className="mt-2">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                required
                                className="block w-full rounded-md border-0 py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border-light placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            className="flex w-full justify-center rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
                        >
                            Login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}