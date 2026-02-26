"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/axios";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

type FoodItem = {
  id: number;
  name: string;
  image?: string;
  calories: number;
  gram_per_serving?: number;
};

type YoloDetection = {
  class_id: number;
  label: string;
  confidence: number;
  box?: any;
};

type DetectedRow = {
  foodItemId: number;
  name: string;
  calories: number;
  gramPerServing: number;
  confidence: number;
  accepted: boolean;
  servings: number;
  gramsPerServingEditable: number;
  previewImage?: string;
};

export default function DetectImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState<DetectedRow[]>([]);
  const [allFoodItems, setAllFoodItems] = useState<FoodItem[]>([]);
  const router = useRouter();

  /** Cleanup previews */
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  /** Load all food items from Laravel */
  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return;

    api
      .get<{ data: FoodItem[] }>("food-diary/food-items/all", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setAllFoodItems(res.data.data))
      .catch((err) => console.error("Failed fetch allFoodItems:", err));
  }, []);

  /** Handle file selection */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected);

    const previewUrls = selected.map((f) => URL.createObjectURL(f));
    setPreviews(previewUrls);
  }

  /** Call YOLO for each uploaded image */
  async function handleSendToYolo() {
    if (files.length === 0) return alert("Please upload at least 1 image.");

    setLoading(true);
    const allDetected: DetectedRow[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.append("file", files[i]);

        const res = await fetch("http://localhost:5001/detect/image", {
          method: "POST",
          body: form,
        });

        const data = await res.json();
        const detections: YoloDetection[] = data.detections ?? [];
        const previewImage = previews[i];

        detections.forEach((det) => {
          const detectedLabel = det.label.toLowerCase().trim();

          const match = allFoodItems.find(
            (item) => item.name.toLowerCase() === detectedLabel
          );

          allDetected.push({
            foodItemId: match?.id ?? -1,
            name: match?.name ?? `Unknown (${det.label})`,
            calories: match?.calories ?? 0,
            gramPerServing: match?.gram_per_serving ?? 100,
            confidence: det.confidence,
            accepted: true,
            servings: 1,
            gramsPerServingEditable: match?.gram_per_serving ?? 100,
            previewImage,
          });
        });
      }

      // setDetected(allDetected);
      // 
      setDetected((prev) => {
        const updated = [...prev];

        allDetected.forEach((newItem) => {
          const existing = updated.find(
            (x) => x.foodItemId === newItem.foodItemId && x.foodItemId !== -1
          );

          if (existing) {
            // If the item is already in the list, increase servings;
            // existing.servings += 1;
          } else {
            // Otherwise append new item
            updated.push(newItem);
          }
        });

        return updated;
      });

    } catch (err) {
      console.error(err);
      alert("YOLO failed: " + err);
    } finally {
      setLoading(false);
    }
  }

  /** Update a row */
  function updateRow(index: number, patch: Partial<DetectedRow>) {
    setDetected((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  /** Append accepted detections to food diary */
  function handleAppendToDiary() {
    const accepted = detected.filter((d) => d.accepted);
    if (accepted.length === 0) {
      alert("No accepted items to append.");
      return;
    }

    const toAppend = accepted.map((d) => {
      const totalGrams =
        (d.gramsPerServingEditable ?? d.gramPerServing) * d.servings;

      return {
        foodItemId: d.foodItemId,
        portionSize: totalGrams / 100,
      };
    });

    try {
      localStorage.setItem("yolo_detected_foods", JSON.stringify(toAppend));
      router.push("/food-diary");
    } catch (err) {
      console.error("Failed to save detection:", err);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Image Recognition</h1>

      <div className="mb-6 text-sm text-gray-600">
        <p className="font-medium mb-1">
          Karakteristik Input Gambar yang Didukung:
        </p>
        <ul className="list-disc list-inside mb-2">
          <li>Input dapat berupa gambar meja yang berisi beberapa makanan</li>
          <li>Input dapat berupa gambar 1 objek makanan</li>
        </ul>

        <p className="font-medium mb-1">Catatan Tambahan:</p>
        <ul className="list-disc list-inside">
          <li>Gambar makanan diambil dari sisi bagian atas (top view)</li>
          <li>Gambar makanan memiliki pencahayaan yang cukup</li>
        </ul>
      </div>


      {/* Upload Box */}
      <div className="mb-6">
        <label
          htmlFor="fileInput"
          className="flex flex-col items-center justify-center 
                    w-full max-w-md p-6 
                    border-2 border-dashed border-gray-300 rounded-xl 
                    cursor-pointer hover:bg-gray-50 transition text-center"
        >
          <svg
            className="w-10 h-10 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9"
            ></path>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 13l-3-3m0 0l-3 3m3-3v12"
            ></path>
          </svg>

          <span className="mt-3 text-gray-600 font-medium">
            Click to upload images
          </span>

          <span className="text-sm text-gray-400 mt-1">
            PNG, JPG, JPEG — multiple allowed
          </span>
        </label>

        <input
          id="fileInput"
          type="file"
          accept="image/*"
          multiple
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      {/* Image Preview Grid */}
      {previews.length > 0 && (
        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-4">
          {previews.map((src, i) => (
            <img key={i} src={src} className="max-w-xs rounded-xl shadow" />
          ))}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 my-6">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={handleSendToYolo}
          disabled={loading || files.length === 0}
        >
          {loading ? "Detecting..." : "Send to YOLO"}
        </button>

        <button
          className="px-4 py-2 bg-gray-200 rounded"
          onClick={() => {
            setFiles([]);
            setPreviews([]);
            setDetected([]);
          }}
        >
          Reset
        </button>
      </div>

      {/* Detection Results */}
      {detected.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Detected Items</h2>

          <div className="space-y-3">
            {detected.map((r, i) => (
              <div
                key={i}
                className="p-3 border rounded flex items-center gap-4"
              >
                <input
                  type="checkbox"
                  checked={r.accepted}
                  onChange={(e) =>
                    updateRow(i, { accepted: e.target.checked })
                  }
                />

                <img
                  src={r.previewImage}
                  className="w-20 h-20 object-cover rounded"
                />

                <div className="flex-1">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-gray-500">
                    Confidence: {(r.confidence * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <label className="text-xs">Gram/Serving</label>
                  <input
                    type="number"
                    value={r.gramsPerServingEditable}
                    onChange={(e) =>
                      updateRow(i, {
                        gramsPerServingEditable: Number(e.target.value),
                      })
                    }
                    className="w-20 p-1 border rounded text-sm"
                  />

                  <label className="text-xs">Servings</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={r.servings}
                    onChange={(e) =>
                      updateRow(i, { servings: Number(e.target.value) })
                    }
                    className="w-20 p-1 border rounded text-sm"
                  />
                </div>

                <div className="w-28 text-right">
                  <div className="text-sm">
                    {(r.gramsPerServingEditable * r.servings).toFixed(0)} g
                  </div>
                  <div className="text-xs text-gray-500">
                    Calories:{" "}
                    {(
                      (r.calories / r.gramPerServing) *
                      (r.gramsPerServingEditable * r.servings)
                    ).toFixed(0)}{" "}
                    kcal
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded"
              onClick={handleAppendToDiary}
            >
              Append selected to Food Diary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
