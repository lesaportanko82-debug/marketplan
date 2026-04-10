import { useNavigate } from "react-router";
import { Home } from "lucide-react";
import { Mascot } from "./Mascot";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <Mascot emotion="oops" size={130} />
      <p className="text-[56px] font-bold text-muted-foreground/20 mt-2 mb-1 leading-none">404</p>
      <h2 className="text-foreground mb-1">Ой, такой страницы нет!</h2>
      <p className="text-muted-foreground mb-6 text-[13px]">
        Марк обыскал всё, но не нашёл. Возможно, страница была перемещена.
      </p>
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
      >
        <Home className="w-4 h-4" />
        На главную
      </button>
    </div>
  );
}
