import {useState} from "react";
import { Button } from "@/components/ui/button";


export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="bg-gray-100 min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow text-center">
        <h1 className="text-2xl font-bold mb-4">
          Welcome to my ⚛️ React app built with ⚡ Vite!
        </h1>
        <p className="text-gray-600 mb-2">This is a tailwind template.</p>
        <Button onClick={() => setCount((count) => count + 1)}>
          Clicked {count} times
        </Button>
      </div>
    </main>
  );
}
