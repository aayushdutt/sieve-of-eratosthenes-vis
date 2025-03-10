import { SieveVisualizer } from "@/components/sieve-visualizer";
import Image from "next/image";

export default function Home() {
  return (
    <main className="container mx-auto py-9 px-4">
      <div className="flex flex-col items-center justify-center gap-3 mb-6">
        <Image
          src="/sieve.png"
          alt="Sieve of Eratosthenes"
          width={48}
          height={48}
        />
        <h1 className="text-3xl font-bold text-center">
          Sieve of Eratosthenes Visualizer
        </h1>
      </div>
      <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
        The Sieve of Eratosthenes is an ancient algorithm for finding all prime
        numbers up to a specified limit. This visualization shows how the
        algorithm works by iteratively marking multiples of each prime number as
        composite.
      </p>
      <SieveVisualizer />
    </main>
  );
}
