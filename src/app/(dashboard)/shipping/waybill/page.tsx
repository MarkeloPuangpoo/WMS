import React from 'react';
import { Package, MapPin, Phone, Banknote, QrCode } from 'lucide-react';

export default function InternalWaybill() {
    return (
        <div className="bg-white p-8 min-h-screen flex justify-center items-start">
            {/* กรอบใบปะหน้า ขนาดประมาณ A6 (10cm x 15cm) */}
            <div className="w-[400px] border-2 border-black p-4 bg-white text-black font-sans shadow-lg">

                {/* Header: โลโก้ และ โซนจัดส่ง */}
                <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-3">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter">COLAMARC</h1>
                        <p className="text-xs font-bold text-gray-600">EXPRESS DELIVERY</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase mb-1">Routing Zone</p>
                        {/* โซนตัวใหญ่ๆ ให้คนคัดของโยนขึ้นรถถูกคัน */}
                        <div className="bg-black text-white px-4 py-1 text-3xl font-black rounded-sm">
                            BKK-01
                        </div>
                    </div>
                </div>

                {/* Tracking & Barcode (จำลอง) */}
                <div className="text-center mb-4">
                    {/* แนะนำให้ใช้ไลบรารี react-barcode มาใส่ตรงนี้ */}
                    <div className="w-full h-16 bg-gray-200 flex items-center justify-center border border-dashed border-gray-400 mb-1">
                        <span className="text-gray-500 text-sm font-mono">[ BARCODE: CLM-260307-001 ]</span>
                    </div>
                    <p className="font-mono font-bold text-lg tracking-widest">CLM-260307-001</p>
                </div>

                {/* ข้อมูลผู้รับ (Receiver) */}
                <div className="border-2 border-black rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5" />
                        <h2 className="font-bold text-lg">ผู้รับ (Receiver)</h2>
                    </div>
                    <p className="font-bold text-xl mb-1">คุณ สมชาย ใจดี</p>
                    <div className="flex items-center gap-2 mb-2 bg-yellow-100 p-1 w-fit rounded">
                        <Phone className="w-5 h-5" />
                        {/* เบอร์โทรต้องใหญ่ คนขับจะได้มองเห็นชัดๆ */}
                        <p className="font-bold text-xl">081-234-5678</p>
                    </div>
                    <p className="text-sm leading-relaxed">
                        123/45 หมู่บ้าน แสนสุข ซอย 9<br />
                        ถนน สุขุมวิท แขวง คลองเตย<br />
                        เขต คลองเตย กรุงเทพมหานคร 10110
                    </p>
                </div>

                {/* รายละเอียดเงิน (Payment) - สำคัญมากสำหรับคนขับ */}
                <div className="flex gap-2 mb-4">
                    <div className="flex-1 border-2 border-black p-2 rounded-lg text-center bg-gray-50">
                        <p className="text-xs font-bold text-gray-500 mb-1">ประเภทชำระเงิน</p>
                        <h3 className="font-black text-xl text-green-600">PAID</h3>
                        <p className="text-[10px]">(จ่ายแล้ว ไม่ต้องเก็บเงิน)</p>
                    </div>
                    <div className="flex-1 border-2 border-black p-2 rounded-lg text-center">
                        <p className="text-xs font-bold text-gray-500 mb-1">COD (เก็บปลายทาง)</p>
                        <h3 className="font-black text-2xl">-</h3>
                        <p className="text-[10px]">THB</p>
                    </div>
                </div>

                {/* Order Info & Driver Scan */}
                <div className="flex justify-between items-end border-t-2 border-black pt-3 mt-4">
                    <div className="text-xs space-y-1">
                        <p><b>Order Ref:</b> ORD-998877</p>
                        <p><b>Print Date:</b> 07/03/2026 15:30</p>
                        <p><b>Box:</b> 1 / 1</p>
                        <div className="mt-2 pt-2 border-t border-gray-300">
                            <p className="text-gray-500">หมายเหตุถึงคนขับ:</p>
                            <p className="font-bold text-sm text-red-600">** ระวังแตก โทรหาลูกค้าก่อนเข้าส่ง **</p>
                        </div>
                    </div>

                    {/* QR สำหรับคนขับสแกนปิดงาน */}
                    <div className="text-center flex flex-col items-center">
                        <div className="w-20 h-20 border-2 border-black p-1 flex justify-center items-center">
                            {/* แนะนำให้ใช้ qrcode.react */}
                            <QrCode className="w-full h-full text-black" />
                        </div>
                        <p className="text-[10px] font-bold mt-1 uppercase">Driver Scan</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
