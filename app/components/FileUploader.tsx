import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { formatSize } from 'lib/utils'

interface FileUploaderProps {
    onFileSelect?: (file: File | null) => void;
}

const FileUploader = ({ onFileSelect }: FileUploaderProps) => {
    const [file, setFile] = useState<File | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0] || null;
        setFile(selectedFile);
        onFileSelect?.(selectedFile);
    }, [onFileSelect]);

    const maxFileSize = 20 * 1024 * 1024; // 20MB in bytes

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        accept: { 'application/pdf': ['.pdf'] },
        maxSize: maxFileSize,
    });

    return (
        <div className="w-full">
            {file ? (
                <div className="gradient-border p-4">
                    <div className="uploader-selected-file flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <img src="/images/pdf.png" alt="pdf" className="size-10 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">
                                    {file.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {formatSize(file.size)}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="p-2 ml-2 cursor-pointer hover:bg-gray-100 rounded-full flex-shrink-0"
                            onClick={() => {
                                setFile(null);
                                onFileSelect?.(null);
                            }}
                            aria-label="Remove file"
                        >
                            <img src="/icons/cross.svg" alt="remove" className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div {...getRootProps()} className="gradient-border cursor-pointer">
                    <input {...getInputProps()} />
                    <div className="p-6 text-center">
                        <div className="mx-auto w-16 h-16 flex items-center justify-center mb-2">
                            <img src="/icons/info.svg" alt="upload" className="size-20" />
                        </div>
                        <p className="text-lg text-gray-500">
                            <span className="font-semibold">
                                Click to upload
                            </span> or drag and drop
                        </p>
                        <p className="text-lg text-gray-500">PDF (max {formatSize(maxFileSize)})</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default FileUploader
