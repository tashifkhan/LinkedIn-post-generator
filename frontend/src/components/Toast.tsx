import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastProps {
	message: string;
	type?: "success" | "error" | "info";
	isVisible: boolean;
	onClose: () => void;
	duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
	message,
	type = "success",
	isVisible,
	onClose,
	duration = 3000,
}) => {
	useEffect(() => {
		if (isVisible && duration > 0) {
			const timer = setTimeout(onClose, duration);
			return () => clearTimeout(timer);
		}
	}, [isVisible, duration, onClose]);

	const typeStyles = {
		success: "bg-green-600 text-white",
		error: "bg-red-600 text-white",
		info: "bg-blue-600 text-white",
	};

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 0, y: -50, scale: 0.9 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -50, scale: 0.9 }}
					className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${typeStyles[type]} max-w-sm`}
				>
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">{message}</span>
						<button
							onClick={onClose}
							className="ml-3 text-white hover:text-gray-200 text-lg leading-none"
						>
							×
						</button>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
