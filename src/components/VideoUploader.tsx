import React, { useState, useRef, useCallback } from 'react';
import { Upload, Film, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

interface TourNode {
    id: string;
    panorama: string;
    name: string;
    gps: [number, number];
    links: { nodeId: string }[];
}

interface VideoUploaderProps {
    onTourReady: (nodes: TourNode[], tourId: string) => void;
    onCancel: () => void;
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export function VideoUploader({ onTourReady, onCancel }: VideoUploaderProps) {
    const [state, setState] = useState<UploadState>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = useCallback(async (file: File) => {
        if (!file.type.startsWith('video/')) {
            setError('Please select a valid video file.');
            setState('error');
            return;
        }

        setFileName(file.name);
        setState('uploading');
        setProgress(0);
        setError('');

        const formData = new FormData();
        formData.append('video', file);

        try {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    setProgress(Math.round((e.loaded / e.total) * 100));
                }
            });

            xhr.upload.addEventListener('load', () => {
                setState('processing');
            });

            const response = await new Promise<any>((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            reject(new Error(err.error || 'Upload failed'));
                        } catch {
                            reject(new Error('Upload failed'));
                        }
                    }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.open('POST', '/api/upload-video');
                xhr.send(formData);
            });

            if (response.success && response.nodes?.length > 0) {
                setState('done');
                setTimeout(() => {
                    onTourReady(response.nodes, response.tourId);
                }, 1200);
            } else {
                setError('No frames could be extracted from the video.');
                setState('error');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to process video.');
            setState('error');
        }
    }, [onTourReady]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8">
            {/* Cancel Button */}
            <button
                onClick={onCancel}
                className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all z-10"
            >
                <X size={20} />
            </button>

            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl border border-white/10 mb-4">
                        <Film size={28} className="text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-semibold text-white/90 tracking-tight">Create Virtual Tour</h2>
                    <p className="text-white/40 mt-2 text-sm">Upload a video to generate a 360° walkthrough</p>
                </div>

                {/* Upload Area */}
                {state === 'idle' && (
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
              relative cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300
              ${isDragging
                                ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02]'
                                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                            }
            `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="flex flex-col items-center gap-4">
                            <div className={`p-4 rounded-2xl transition-colors ${isDragging ? 'bg-indigo-500/20' : 'bg-white/5'}`}>
                                <Upload size={32} className={`transition-colors ${isDragging ? 'text-indigo-400' : 'text-white/40'}`} />
                            </div>
                            <div>
                                <p className="text-white/70 font-medium">Drop your video here</p>
                                <p className="text-white/30 text-sm mt-1">or click to browse • MP4, WebM, MOV up to 500MB</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Uploading State */}
                {state === 'uploading' && (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-indigo-500/20 rounded-xl">
                                <Upload size={20} className="text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white/80 font-medium text-sm truncate">{fileName}</p>
                                <p className="text-white/40 text-xs mt-0.5">Uploading...</p>
                            </div>
                            <span className="text-indigo-400 font-mono text-sm font-semibold">{progress}%</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Processing State */}
                {state === 'processing' && (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl text-center">
                        <Loader2 size={40} className="text-indigo-400 animate-spin mx-auto mb-4" />
                        <p className="text-white/80 font-medium">Extracting frames...</p>
                        <p className="text-white/40 text-sm mt-2">ffmpeg is processing your video into panoramic nodes. This may take a moment.</p>
                    </div>
                )}

                {/* Done State */}
                {state === 'done' && (
                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-8 backdrop-blur-xl text-center">
                        <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
                        <p className="text-white/80 font-medium">Tour ready!</p>
                        <p className="text-white/40 text-sm mt-2">Loading the virtual tour viewer...</p>
                    </div>
                )}

                {/* Error State */}
                {state === 'error' && (
                    <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 backdrop-blur-xl text-center">
                        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
                        <p className="text-white/80 font-medium">Something went wrong</p>
                        <p className="text-red-300/70 text-sm mt-2">{error}</p>
                        <button
                            onClick={() => { setState('idle'); setError(''); }}
                            className="mt-6 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl border border-white/10 transition-colors text-sm font-medium"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
