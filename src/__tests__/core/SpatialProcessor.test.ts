import { SpatialProcessor, type HandLandmarks, type Point3D } from "../../core/SpatialProcessor";

function makeLandmarks(overrides: Partial<Record<number, Point3D>> = {}): HandLandmarks {
  const defaults: HandLandmarks = Array.from({ length: 21 }, () => ({
    x: 0.5, y: 0.5, z: 0,
  }));
  for (const [idx, val] of Object.entries(overrides)) {
    defaults[Number(idx)] = val;
  }
  return defaults;
}

describe("SpatialProcessor", () => {
  let processor: SpatialProcessor;

  beforeEach(async () => {
    processor = new SpatialProcessor();
    await processor.initialize();
  });

  afterEach(async () => {
    await processor.dispose();
  });

  it("should initialize without errors", () => {
    expect(processor).toBeDefined();
  });

  it("should return empty result for invalid landmarks", () => {
    const result = processor.processLandmarks([]);
    expect(result.handDetected).toBe(false);
    expect(result.type).toBe("NONE");
    expect(result.confidence).toBe(0);
  });

  it("should detect hand from valid 21-point landmarks", () => {
    const landmarks = makeLandmarks();
    const result = processor.processLandmarks(landmarks);
    expect(result.handDetected).toBe(true);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it("should normalize hand position to 0-1 range", () => {
    const landmarks = makeLandmarks();
    const result = processor.processLandmarks(landmarks);
    expect(result.normalizedPosition.x).toBeGreaterThanOrEqual(0);
    expect(result.normalizedPosition.x).toBeLessThanOrEqual(1);
    expect(result.normalizedPosition.y).toBeGreaterThanOrEqual(0);
    expect(result.normalizedPosition.y).toBeLessThanOrEqual(1);
  });

  it("should detect pinch when index tip and thumb tip are close", () => {
    const landmarks = makeLandmarks({
      4: { x: 0.5, y: 0.5, z: 0 },   // Thumb tip
      8: { x: 0.51, y: 0.51, z: 0 },  // Index tip (very close)
    });

    // Process multiple frames for stability
    for (let i = 0; i < 5; i++) {
      processor.processLandmarks(landmarks);
    }
    const result = processor.processLandmarks(landmarks);
    expect(result.pinchDistance).toBeLessThan(0.1);
  });

  it("should calculate velocity between frames", () => {
    const landmarks1 = makeLandmarks();
    processor.processLandmarks(landmarks1);

    // Move hand to the right
    const landmarks2 = makeLandmarks({
      0: { x: 0.7, y: 0.5, z: 0 },
      5: { x: 0.7, y: 0.5, z: 0 },
      9: { x: 0.7, y: 0.5, z: 0 },
      13: { x: 0.7, y: 0.5, z: 0 },
      17: { x: 0.7, y: 0.5, z: 0 },
    });
    const result = processor.processLandmarks(landmarks2);
    expect(result.velocity.x).not.toBe(0);
  });

  it("should fire gesture callbacks", () => {
    const callback = jest.fn();
    const unsub = processor.onGesture(callback);

    const landmarks = makeLandmarks();
    processor.processLandmarks(landmarks);
    expect(callback).toHaveBeenCalledTimes(1);

    unsub();
    processor.processLandmarks(landmarks);
    expect(callback).toHaveBeenCalledTimes(1); // Not called again
  });
});
