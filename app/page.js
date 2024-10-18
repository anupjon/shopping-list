import dynamic from 'next/dynamic'

const ShoppingList = dynamic(() => import('./components/ShoppingList'), {
  ssr: false,
})

export default function Home() {
  return (
    <main className="flex w-full flex-col gap-8 row-start-2 items-center sm:items-start">        
      <ShoppingList/>                
    </main>     
  );
}
