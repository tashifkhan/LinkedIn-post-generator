import React from "react";

export const Loader: React.FC = () => {
	return (
		<div className="flex justify-center items-center py-6">
			<div className="relative w-12 h-12">
				<div className="absolute inset-0 rounded-full border-4 border-t-transparent border-cyan-400 animate-spin"></div>
				<div className="absolute inset-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10"></div>
			</div>
		</div>
	);
};
