import React from "react";

export const Loader: React.FC = () => {
	return (
		<div className="flex flex-col items-center gap-3 py-6">
			<div className="relative w-12 h-12">
				<div className="absolute inset-0 rounded-full border-4 border-t-transparent border-[color:var(--accent)] animate-spin"></div>
				<div className="absolute inset-1 rounded-full bg-[color:var(--card-bg)] border border-[color:var(--card-border)]"></div>
			</div>
			<div aria-hidden className="w-48 progress-bar"></div>
		</div>
	);
};
