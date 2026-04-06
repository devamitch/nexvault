/**
 * WidgetBridge.test.ts - Widget Data Sync Tests
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { syncWidgetData, getWidgetData, isWidgetSupported, getWidgetSupportInfo } from "../../widgets/WidgetBridge";

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

const mockData = {
  vaultItemCount: 5,
  memoCount: 3,
  latestMemoTimestamp: 1700000000000,
  isListening: false,
};

describe("WidgetBridge", () => {
  it("syncWidgetData saves to AsyncStorage", async () => {
    await syncWidgetData(mockData);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@nexvault/widget_data",
      JSON.stringify(mockData)
    );
  });

  it("getWidgetData reads from AsyncStorage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockData));
    const data = await getWidgetData();
    expect(data).toEqual(mockData);
  });

  it("getWidgetData returns defaults when storage empty", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const data = await getWidgetData();
    expect(data).toEqual({
      vaultItemCount: 0,
      memoCount: 0,
      latestMemoTimestamp: null,
      isListening: false,
    });
  });

  it("getWidgetData returns defaults on parse error", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("invalid json{{{");
    const data = await getWidgetData();
    expect(data.vaultItemCount).toBe(0);
  });

  it("isWidgetSupported returns false when native module absent", () => {
    // No native module linked in test environment
    expect(isWidgetSupported()).toBe(false);
  });

  it("getWidgetSupportInfo returns descriptive string", () => {
    const info = getWidgetSupportInfo();
    expect(typeof info).toBe("string");
    expect(info.length).toBeGreaterThan(0);
  });
});
