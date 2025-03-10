"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useDeferredValue,
} from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, RotateCcw, StepForward, Info } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Prime family types
type PrimeFamily = "all" | "twin" | "mersenne" | "fermat" | "sophie-germain";

// Prime number with additional properties
interface PrimeNumber {
  value: number;
  state: "unmarked" | "prime" | "composite";
  families: PrimeFamily[];
  gap?: number; // Gap from previous prime
}

export function SieveVisualizer() {
  const [maxNumber, setMaxNumber] = useState(100);
  const [speed, setSpeed] = useState(100);
  const [numbers, setNumbers] = useState<PrimeNumber[]>([]);
  const [currentPrime, setCurrentPrime] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentMultiple, setCurrentMultiple] = useState(0);
  const [selectedFamily, setSelectedFamily] = useState<PrimeFamily>("all");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedPrime, setSelectedPrime] = useState<number | null>(null);

  // Add memoization for filtered numbers
  const deferredNumbers = useDeferredValue(numbers);

  // Memoize the resetSieve function
  const resetSieve = useCallback(() => {
    const newNumbers = Array.from({ length: maxNumber }, (_, i) => ({
      value: i + 1,
      state: i === 0 ? ("prime" as const) : ("unmarked" as const),
      families: [] as PrimeFamily[],
    }));

    setNumbers(newNumbers);
    setCurrentPrime(2);
    setCurrentMultiple(0);
    setIsRunning(false);
    setIsComplete(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [maxNumber]);

  // Initialize the numbers array
  useEffect(() => {
    resetSieve();
  }, [maxNumber, resetSieve]);

  // Calculate prime count and estimated prime count
  const primeStats = useMemo(() => {
    const primes = numbers
      .filter((n) => n.state === "prime")
      .map((n) => n.value);
    const primeCount = primes.length;

    // Calculate estimated prime count using Prime Number Theorem: n/ln(n)
    const estimatedCount =
      maxNumber > 1 ? Math.round(maxNumber / Math.log(maxNumber)) : 0;

    // Calculate prime gaps
    const gaps = [];
    for (let i = 1; i < primes.length; i++) {
      gaps.push(primes[i] - primes[i - 1]);
    }

    const avgGap =
      gaps.length > 0
        ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
        : 0;
    const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;

    // Generate data for the chart - now based on current progress
    const chartData = [];
    let actualCount = 0;

    // Determine the highest number we've processed so far
    const highestProcessed = isComplete
      ? maxNumber
      : Math.max(
          currentPrime,
          currentMultiple > 0 ? currentMultiple - currentPrime : 0
        );

    for (
      let i = 10;
      i <= maxNumber;
      i += Math.max(1, Math.floor(maxNumber / 20))
    ) {
      // Only count primes up to the point we've processed
      if (i <= highestProcessed) {
        actualCount = numbers.filter(
          (n) => n.value <= i && n.state === "prime"
        ).length;
      } else if (chartData.length > 0) {
        // For unprocessed points, use the last known actual count
        actualCount = chartData[chartData.length - 1].actual;
      }

      const estimated = i > 1 ? i / Math.log(i) : 0;
      chartData.push({
        n: i,
        actual: actualCount,
        estimated: Math.round(estimated * 100) / 100,
      });
    }

    // Add the final point
    if (
      chartData.length === 0 ||
      chartData[chartData.length - 1].n !== maxNumber
    ) {
      // Only use actual count if we've processed up to maxNumber
      const finalActualCount = isComplete
        ? primeCount
        : highestProcessed >= maxNumber
        ? numbers.filter((n) => n.state === "prime").length
        : chartData.length > 0
        ? chartData[chartData.length - 1].actual
        : 0;

      chartData.push({
        n: maxNumber,
        actual: finalActualCount,
        estimated:
          Math.round(
            (maxNumber > 1 ? maxNumber / Math.log(maxNumber) : 0) * 100
          ) / 100,
      });
    }

    return {
      primeCount,
      estimatedCount,
      density: primeCount / maxNumber,
      avgGap,
      maxGap,
      chartData,
    };
  }, [numbers, maxNumber, currentPrime, currentMultiple, isComplete]);

  // Optimize performStep with useCallback
  const performStep = useCallback(() => {
    if (isComplete) return;

    setNumbers((prevNumbers) => {
      const newNumbers = [...prevNumbers];

      // If we haven't started marking multiples for the current prime yet
      if (currentMultiple === 0) {
        // Mark the current prime
        const primeIndex = currentPrime - 1;
        newNumbers[primeIndex].state = "prime";

        // Set up to mark the first multiple
        setCurrentMultiple(currentPrime * 2);
        return newNumbers;
      }

      // Mark the current multiple as composite
      if (currentMultiple <= maxNumber) {
        const multipleIndex = currentMultiple - 1;
        newNumbers[multipleIndex].state = "composite";

        // Move to the next multiple
        setCurrentMultiple(currentMultiple + currentPrime);
        return newNumbers;
      }

      // Find the next prime
      const nextPrime = findNextPrime(newNumbers, currentPrime);

      if (nextPrime) {
        setCurrentPrime(nextPrime);
        setCurrentMultiple(0);
      } else {
        // Mark any remaining unmarked numbers as prime
        for (let i = 0; i < newNumbers.length; i++) {
          if (newNumbers[i].state === "unmarked") {
            newNumbers[i].state = "prime";
          }
        }

        // Identify prime families when complete
        const updatedWithFamilies = identifyPrimeFamilies(newNumbers);
        setIsComplete(true);
        setIsRunning(false);
        return updatedWithFamilies;
      }

      return newNumbers;
    });
  }, [currentMultiple, currentPrime, isComplete, maxNumber]);

  // Update the useEffect for animation
  useEffect(() => {
    if (isRunning && !isComplete) {
      const delay = 1000 - speed * 9;
      timeoutRef.current = setTimeout(performStep, delay);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [isRunning, isComplete, speed, performStep]);

  // Find the next prime number
  const findNextPrime = (
    nums: PrimeNumber[],
    startFrom: number
  ): number | null => {
    for (let i = startFrom; i < nums.length; i++) {
      if (nums[i].state === "unmarked") {
        return nums[i].value;
      }
    }
    return null;
  };

  // Check if a number is a power of 2
  const isPowerOfTwo = (n: number): boolean => {
    return n > 0 && (n & (n - 1)) === 0;
  };

  // Check if a number is a Mersenne prime (2^n - 1)
  const isMersennePrime = (p: number): boolean => {
    // Check if p is of form 2^n - 1
    const n = p + 1;
    return isPowerOfTwo(n);
  };

  // Check if a number is a Fermat prime (2^(2^n) + 1)
  const isFermatPrime = (p: number): boolean => {
    // Known Fermat primes: 3, 5, 17, 257, 65537
    return [3, 5, 17, 257, 65537].includes(p);
  };

  // Identify special prime families
  const identifyPrimeFamilies = (nums: PrimeNumber[]): PrimeNumber[] => {
    const primes = nums.filter((n) => n.state === "prime").map((n) => n.value);
    const primeSet = new Set(primes);

    // Create a copy of the numbers array
    const updatedNumbers = [...nums];

    // Identify twin primes
    for (const p of primes) {
      if (primeSet.has(p + 2)) {
        const idx1 = updatedNumbers.findIndex((n) => n.value === p);
        const idx2 = updatedNumbers.findIndex((n) => n.value === p + 2);

        if (idx1 >= 0 && !updatedNumbers[idx1].families.includes("twin")) {
          updatedNumbers[idx1].families.push("twin");
        }

        if (idx2 >= 0 && !updatedNumbers[idx2].families.includes("twin")) {
          updatedNumbers[idx2].families.push("twin");
        }
      }
    }

    // Identify Mersenne primes
    for (const p of primes) {
      if (isMersennePrime(p)) {
        const idx = updatedNumbers.findIndex((n) => n.value === p);
        if (idx >= 0 && !updatedNumbers[idx].families.includes("mersenne")) {
          updatedNumbers[idx].families.push("mersenne");
        }
      }
    }

    // Identify Fermat primes
    for (const p of primes) {
      if (isFermatPrime(p)) {
        const idx = updatedNumbers.findIndex((n) => n.value === p);
        if (idx >= 0 && !updatedNumbers[idx].families.includes("fermat")) {
          updatedNumbers[idx].families.push("fermat");
        }
      }
    }

    // Identify Sophie Germain primes
    for (const p of primes) {
      if (primeSet.has(2 * p + 1)) {
        const idx = updatedNumbers.findIndex((n) => n.value === p);
        if (
          idx >= 0 &&
          !updatedNumbers[idx].families.includes("sophie-germain")
        ) {
          updatedNumbers[idx].families.push("sophie-germain");
        }
      }
    }

    // Calculate prime gaps
    let lastPrimeIndex = -1;
    for (let i = 0; i < updatedNumbers.length; i++) {
      if (updatedNumbers[i].state === "prime") {
        if (lastPrimeIndex >= 0) {
          updatedNumbers[i].gap =
            updatedNumbers[i].value - updatedNumbers[lastPrimeIndex].value;
        }
        lastPrimeIndex = i;
      }
    }

    return updatedNumbers;
  };

  // When the algorithm completes, identify prime families
  useEffect(() => {
    if (isComplete) {
      // Only update if we haven't already identified families
      const hasIdentifiedFamilies = numbers.some((n) => n.families.length > 0);
      if (!hasIdentifiedFamilies) {
        setNumbers((prevNumbers) => identifyPrimeFamilies(prevNumbers));
      }
    }
  }, [isComplete, numbers]);

  // Optimize the grid rendering with virtualization for large numbers
  const getGridColumns = useCallback(() => {
    if (maxNumber <= 100) return "grid-cols-10";
    if (maxNumber <= 225) return "grid-cols-15";
    return "grid-cols-20";
  }, [maxNumber]);

  // Filter numbers based on selected family - with memoization
  const filteredNumbers = useMemo(() => {
    if (selectedFamily === "all") {
      return deferredNumbers;
    }
    return deferredNumbers.map((num) => ({
      ...num,
      highlighted: num.families.includes(selectedFamily),
    }));
  }, [deferredNumbers, selectedFamily]);

  // Add this helper function to find factors
  const findFactors = useCallback((num: number): number[] => {
    const factors: number[] = [];

    // Find the smallest prime factor first
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) {
        factors.push(i);
        // If we're showing all factors, add the complementary factor
        if (i !== num / i) {
          factors.push(num / i);
        }
        break;
      }
    }

    // If no factors were found, the number is prime
    if (factors.length === 0 && num > 1) {
      return [1, num];
    } else if (num === 1) {
      return [1];
    }

    // Sort the factors
    return [1, ...factors.sort((a, b) => a - b), num];
  }, []);

  // Optimize the grid rendering for large numbers
  const renderGrid = useMemo(() => {
    const gridClass = getGridColumns();

    if (filteredNumbers.length > 200) {
      // For large datasets, use a more efficient rendering approach
      return (
        <div className={`grid ${gridClass} gap-2 justify-center`}>
          {filteredNumbers.map((number, index) => {
            const isHighlighted =
              selectedFamily !== "all" &&
              number.families.includes(selectedFamily);

            return (
              <Popover key={index}>
                <PopoverTrigger asChild>
                  <div
                    className={`
                      flex items-center justify-center h-10 w-10 rounded-md text-sm font-medium
                      ${
                        number.value === currentPrime &&
                        currentMultiple === 0 &&
                        !isComplete
                          ? "ring-2 ring-primary"
                          : ""
                      }
                      ${
                        number.value === currentMultiple && !isComplete
                          ? "ring-2 ring-orange-500"
                          : ""
                      }
                      ${
                        number.state === "unmarked"
                          ? "bg-muted text-muted-foreground"
                          : number.state === "prime"
                          ? isHighlighted
                            ? "bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-100 ring-2 ring-purple-500"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                      }
                      cursor-pointer hover:ring-2 hover:ring-blue-400
                      ${
                        selectedPrime === number.value
                          ? "ring-2 ring-blue-500"
                          : ""
                      }
                    `}
                  >
                    {number.value}
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  className="p-4 w-auto max-w-[200px]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-semibold">
                        {number.value}
                      </div>
                      <Badge
                        variant={
                          number.state === "prime"
                            ? "default"
                            : number.state === "composite"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {number.state === "prime"
                          ? "Prime"
                          : number.state === "composite"
                          ? "Composite"
                          : "Unmarked"}
                      </Badge>
                    </div>

                    {number.gap && number.state === "prime" && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Gap:</span>
                        <span>{number.gap}</span>
                      </div>
                    )}

                    {number.state === "composite" && (
                      <div className="text-sm">
                        <div className="text-muted-foreground mb-1">
                          Factors:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {findFactors(number.value).map((factor, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-xs"
                            >
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {number.families.length > 0 && (
                      <div className="text-sm">
                        <div className="text-muted-foreground mb-1">
                          Special families:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {number.families.map((family) => (
                            <Badge
                              key={family}
                              variant="secondary"
                              className="text-xs"
                            >
                              {family === "twin" && "Twin"}
                              {family === "mersenne" && "Mersenne"}
                              {family === "fermat" && "Fermat"}
                              {family === "sophie-germain" && "Sophie Germain"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      );
    }

    // For smaller datasets, use the original rendering with animations
    return (
      <div className={`grid ${gridClass} gap-2 justify-center`}>
        {filteredNumbers.map((number, index) => {
          const isHighlighted =
            selectedFamily !== "all" &&
            number.families.includes(selectedFamily);

          return (
            <Popover key={index}>
              <PopoverTrigger asChild>
                <motion.div
                  className={`
                    flex items-center justify-center h-10 w-10 rounded-md text-sm font-medium
                    ${
                      number.value === currentPrime &&
                      currentMultiple === 0 &&
                      !isComplete
                        ? "ring-2 ring-primary"
                        : ""
                    }
                    ${
                      number.value === currentMultiple && !isComplete
                        ? "ring-2 ring-orange-500"
                        : ""
                    }
                    ${
                      number.state === "unmarked"
                        ? "bg-muted text-muted-foreground"
                        : number.state === "prime"
                        ? isHighlighted
                          ? "bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-100 ring-2 ring-purple-500"
                          : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                    }
                    cursor-pointer hover:ring-2 hover:ring-blue-400
                    ${
                      selectedPrime === number.value
                        ? "ring-2 ring-blue-500"
                        : ""
                    }
                  `}
                  initial={{ opacity: 0.6, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    backgroundColor:
                      number.state === "unmarked"
                        ? "#f1f5f9"
                        : number.state === "prime"
                        ? isHighlighted
                          ? "#e9d5ff"
                          : "#dcfce7"
                        : "#fee2e2",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {number.value}
                </motion.div>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="center"
                className="p-4 w-auto max-w-[200px]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-lg font-semibold">{number.value}</div>
                    <Badge
                      variant={
                        number.state === "prime"
                          ? "default"
                          : number.state === "composite"
                          ? "destructive"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {number.state === "prime"
                        ? "Prime"
                        : number.state === "composite"
                        ? "Composite"
                        : "Unmarked"}
                    </Badge>
                  </div>

                  {number.gap && number.state === "prime" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gap:</span>
                      <span>{number.gap}</span>
                    </div>
                  )}

                  {number.state === "composite" && (
                    <div className="text-sm">
                      <div className="text-muted-foreground mb-1">Factors:</div>
                      <div className="flex flex-wrap gap-1">
                        {findFactors(number.value).map((factor, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {number.families.length > 0 && (
                    <div className="text-sm">
                      <div className="text-muted-foreground mb-1">
                        Special families:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {number.families.map((family) => (
                          <Badge
                            key={family}
                            variant="secondary"
                            className="text-xs"
                          >
                            {family === "twin" && "Twin"}
                            {family === "mersenne" && "Mersenne"}
                            {family === "fermat" && "Fermat"}
                            {family === "sophie-germain" && "Sophie Germain"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    );
  }, [
    filteredNumbers,
    getGridColumns,
    currentPrime,
    currentMultiple,
    isComplete,
    selectedFamily,
    selectedPrime,
    findFactors,
  ]);

  return (
    <div className="flex flex-col items-center gap-8">
      <Card className="w-full max-w-4xl">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Sieve of Eratosthenes</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Info className="h-4 w-4" />
                    <span>How it works</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                  <h3 className="font-medium mb-2">
                    How the Sieve of Eratosthenes Works:
                  </h3>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>
                      Start with all numbers from 2 to n marked as potential
                      primes.
                    </li>
                    <li>
                      Take the smallest unmarked number (starting with 2), mark
                      it as prime.
                    </li>
                    <li>
                      Mark all multiples of that prime as composite (not prime).
                    </li>
                    <li>
                      Move to the next unmarked number and repeat steps 2-3.
                    </li>
                    <li>
                      When all numbers have been processed, the remaining
                      unmarked numbers are prime.
                    </li>
                  </ol>
                  <p className="mt-2 text-muted-foreground">
                    This algorithm efficiently finds all prime numbers up to any
                    given limit by iteratively marking the multiples of each
                    prime, starting from 2.
                  </p>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">
                  Maximum Number: {maxNumber}
                </span>
              </div>
              <Slider
                value={[maxNumber]}
                min={10}
                max={500}
                step={10}
                onValueChange={(value) => setMaxNumber(value[0])}
                disabled={isRunning}
              />
              <p className="text-xs text-muted-foreground">10-500 numbers</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Animation Speed</span>
              </div>
              <Slider
                value={[speed]}
                min={1}
                max={300}
                step={5}
                onValueChange={(value) => setSpeed(value[0])}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsRunning(!isRunning)}
                  disabled={isComplete}
                >
                  {isRunning ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={performStep}
                  disabled={isRunning || isComplete}
                >
                  <StepForward className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={resetSieve}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Filter:</span>
                <Select
                  value={selectedFamily}
                  onValueChange={(value) =>
                    setSelectedFamily(value as PrimeFamily)
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Primes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Primes</SelectItem>
                    <SelectItem value="twin">Twin Primes</SelectItem>
                    <SelectItem value="mersenne">Mersenne Primes</SelectItem>
                    <SelectItem value="fermat">Fermat Primes</SelectItem>
                    <SelectItem value="sophie-germain">
                      Sophie Germain Primes
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="grid" className="w-full max-w-4xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="grid">Sieve Visualization</TabsTrigger>
          <TabsTrigger value="stats">Prime Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-4">
          <div className="w-full overflow-auto p-4 border rounded-lg bg-background">
            {renderGrid}
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted rounded"></div>
              <span className="text-sm">Unmarked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 dark:bg-green-900 rounded"></div>
              <span className="text-sm">Prime</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 dark:bg-red-900 rounded"></div>
              <span className="text-sm">Composite</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-primary"></div>
              <span className="text-sm">Current Prime</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-orange-500"></div>
              <span className="text-sm">Current Multiple</span>
            </div>
            {selectedFamily !== "all" && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-200 dark:bg-purple-900 rounded ring-2 ring-purple-500"></div>
                <span className="text-sm">Highlighted Prime</span>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      Prime Count π(n)
                    </div>
                    <div className="text-2xl font-bold">
                      {primeStats.primeCount}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      vs. estimated {Math.round(primeStats.estimatedCount)}
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      Prime Density
                    </div>
                    <div className="text-2xl font-bold">
                      {(primeStats.density * 100).toFixed(2)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {primeStats.primeCount} primes in {maxNumber} numbers
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      Prime Gaps
                    </div>
                    <div className="text-2xl font-bold">
                      {primeStats.avgGap.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Average gap (max: {primeStats.maxGap})
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">
                      Prime Number Theorem Comparison
                    </h3>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="left"
                        align="center"
                        className="max-w-xs"
                      >
                        <p className="text-sm">
                          The Prime Number Theorem states that π(n), the number
                          of primes less than or equal to n, is approximately
                          n/ln(n) for large n.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={primeStats.chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="n"
                          label={{
                            value: "n",
                            position: "insideBottomRight",
                            offset: -5,
                          }}
                        />
                        <YAxis
                          label={{
                            value: "Count of Primes",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <Tooltip formatter={(value) => [value, ""]} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          name="Actual π(n)"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="estimated"
                          name="Estimated n/ln(n)"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">
                      Special Prime Families
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Twin Primes</Badge>
                          <span className="text-sm text-muted-foreground">
                            {
                              numbers.filter((n) => n.families.includes("twin"))
                                .length
                            }{" "}
                            found
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pairs of primes that differ by 2 (p, p+2)
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Mersenne Primes</Badge>
                          <span className="text-sm text-muted-foreground">
                            {
                              numbers.filter((n) =>
                                n.families.includes("mersenne")
                              ).length
                            }{" "}
                            found
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Primes of the form 2^n - 1
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Fermat Primes</Badge>
                          <span className="text-sm text-muted-foreground">
                            {
                              numbers.filter((n) =>
                                n.families.includes("fermat")
                              ).length
                            }{" "}
                            found
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Primes of the form 2^(2^n) + 1
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Sophie Germain Primes</Badge>
                          <span className="text-sm text-muted-foreground">
                            {
                              numbers.filter((n) =>
                                n.families.includes("sophie-germain")
                              ).length
                            }{" "}
                            found
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Primes p where 2p+1 is also prime
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">
                      Prime Distribution Insights
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      The distribution of prime numbers becomes less dense as
                      numbers get larger, following the Prime Number Theorem.
                    </p>

                    <div className="space-y-2">
                      <div>
                        <div className="text-sm font-medium">Prime Density</div>
                        <div className="text-xs text-muted-foreground">
                          The density of primes decreases approximately as
                          1/ln(n).
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium">Prime Gaps</div>
                        <div className="text-xs text-muted-foreground">
                          The gaps between consecutive primes tend to increase
                          as numbers get larger.
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium">
                          Largest Gap Found
                        </div>
                        <div className="text-xs">
                          {primeStats.maxGap} (between consecutive primes)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
