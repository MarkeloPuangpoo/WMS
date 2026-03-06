"use client";

import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, X, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
    onScan: (result: string) => void;
    onClose: () => void;
    title?: string;
    description?: string;
}

export function BarcodeScanner({ onScan, onClose, title = "Scan Code", description = "Align the barcode or QR code within the frame" }: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(true);
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

    useEffect(() => {
        let isComponentMounted = true;
        codeReaderRef.current = new BrowserMultiFormatReader();

        const startScanning = async () => {
            try {
                // Determine if the browser supports mediaDevices
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('MediaDevices API not supported. Please ensure you are using HTTPS or a supported browser.');
                }

                // Request camera permission explicitly first to handle denied states gracefully
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

                // If the user approves, pass the stream/device id to zxing
                if (videoRef.current && isComponentMounted && codeReaderRef.current) {
                    codeReaderRef.current.decodeFromVideoDevice(
                        null as unknown as string, // Cast to avoid strict type issue
                        videoRef.current,
                        (result, err) => {
                            if (result && isComponentMounted) {
                                // Successfully scanned something!
                                // Play a beep sound (optional, helps UX)
                                try {
                                    const audio = new Audio('/beep.mp3'); // Assuming there might be a beep.mp3 in public in a real app
                                    audio.play().catch(() => { });
                                } catch (e) { }

                                onScan(result.getText());
                            }
                            if (err && !(err instanceof NotFoundException)) {
                                console.error(err);
                            }
                        }
                    );
                    setIsStarting(false);
                }
            } catch (err: any) {
                console.error("Camera error:", err);
                if (err.name === 'NotAllowedError') {
                    setError("Camera access denied. Please grant permission in your browser settings.");
                } else if (err.name === 'NotFoundError') {
                    setError("No camera found on this device.");
                } else {
                    setError("Could not start camera. Please try again or type the code manually.");
                }
                setIsStarting(false);
            }
        };

        startScanning();

        return () => {
            isComponentMounted = false;
            // Clean up: stop the camera when component unmounts
            if (codeReaderRef.current) {
                codeReaderRef.current.reset();
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm sm:p-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="safe-area-pt flex items-center justify-between p-4 sm:rounded-t-2xl sm:bg-gray-900 text-white z-10">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Camera className="w-5 h-5 text-primary-400" />
                        {title}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">{description}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Camera Viewport */}
            <div className="relative flex-1 bg-black overflow-hidden sm:rounded-b-2xl shadow-2xl flex items-center justify-center">

                {isStarting && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 bg-black/50">
                        <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-4" />
                        <p className="text-sm font-medium">Initializing camera...</p>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-black">
                        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                            <X className="w-8 h-8 text-red-500" />
                        </div>
                        <p className="text-red-400 mb-6 font-medium max-w-xs">{error}</p>
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition"
                        >
                            Return to App
                        </button>
                    </div>
                )}

                {/* The actual video element where Zxing injects the stream */}
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                />

                {/* Scanning Overlay UI (The targeting box) */}
                {!error && !isStarting && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col">
                        {/* Darkened borders around the scan area */}
                        <div className="flex-1 bg-black/40"></div>
                        <div className="flex justify-center">
                            <div className="w-12 sm:w-1/4 bg-black/40"></div>

                            {/* Clear scan window */}
                            <div className="w-64 h-64 sm:w-80 sm:h-80 relative border-2 border-primary-500/50 rounded-xl overflow-hidden">
                                {/* Scanning Laser Animation */}
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-500 shadow-[0_0_8px_2px_rgba(var(--primary-500),0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>

                                {/* Corner markers */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-lg"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-lg"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-lg"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-lg"></div>
                            </div>

                            <div className="w-12 sm:w-1/4 bg-black/40"></div>
                        </div>
                        <div className="flex-1 bg-black/40"></div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(256px); } /* Approx height of scan window */
                    100% { transform: translateY(0); }
                }
                @media (min-width: 640px) {
                    @keyframes scan {
                        0% { transform: translateY(0); }
                        50% { transform: translateY(320px); }
                        100% { transform: translateY(0); }
                    }
                }
            `}} />
        </div>
    );
}
