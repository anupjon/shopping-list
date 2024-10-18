import Image from "next/image";
import ShoppingList from "./components/ShoppingList";


export default function Home() {
  return (

      <main className="flex w-full flex-col gap-8 row-start-2 items-center sm:items-start font-[family-name:var(--font-geist-sans)]">
        
        <ShoppingList/>        
        
      </main>
      
 
  );
}
