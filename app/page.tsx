import { SieveVisualizer } from "@/components/sieve-visualizer"

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-center mb-6">Sieve of Eratosthenes Visualizer</h1>
      <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
        The Sieve of Eratosthenes is an ancient algorithm for finding all prime numbers up to a specified limit. This
        visualization shows how the algorithm works by iteratively marking multiples of each prime number as composite.
      </p>
      <SieveVisualizer />
    </main>
  )
}

