import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import App from "./App";
import Prompts from "./pages/Prompts";
import FAQ from "./pages/FAQ";

export default function AppRouter() {
	return (
		<>
			<NavBar />
			<Routes>
				<Route path="/" element={<App />} />
				<Route path="/prompts" element={<Prompts />} />
				<Route path="/faq" element={<FAQ />} />
			</Routes>
		</>
	);
}
