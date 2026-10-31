import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X } from "lucide-react";
import { auth } from "../lib/firebase";
import { uploadMedia } from "../lib/cloudinary";
import Sidebar from "../components/Sidebar";
import { apiRequest } from "../lib/api";

const CreateBattle = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    category: "UI/UX",
    entry_A: {
      title: "",
      description: "",
      image_url: "",
      author: "",
    },
    entry_B: {
      title: "",
      description: "",
      image_url: "",
      author: "",
    },
    endTime: "",
  });

  const [imageLoading, setImageLoading] = useState({
    entry_A: false,
    entry_B: false,
  });

  const categories = [
    "UI/UX",
    "Branding",
    "Web Dev",
    "Mobile",
    "Design",
    "Photography",
    "Illustration",
    "Animation",
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEntryChange = (entry, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [entry]: { ...prev[entry], [field]: value },
    }));
  };

  const handleImageUpload = async (e, entry) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageLoading((prev) => ({ ...prev, [entry]: true }));
    try {
      const uploaded = await uploadMedia(file, "battle");
      handleEntryChange(entry, "image_url", uploaded.url);
    } catch (err) {
      setError(err.message || "Failed to upload image");
    } finally {
      setImageLoading((prev) => ({ ...prev, [entry]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      setError("Battle title is required");
      return;
    }
    if (!formData.entry_A.title.trim() || !formData.entry_B.title.trim()) {
      setError("Both entries need titles");
      return;
    }
    if (!formData.entry_A.image_url || !formData.entry_B.image_url) {
      setError("Both entries need images");
      return;
    }
    if (
      !formData.entry_A.description.trim() ||
      !formData.entry_B.description.trim()
    ) {
      setError("Both entries need descriptions");
      return;
    }
    if (!formData.endTime) {
      setError("End time is required");
      return;
    }

    const endDate = new Date(formData.endTime);
    if (endDate <= new Date()) {
      setError("End time must be in the future");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        navigate("/login");
        return;
      }

      const payload = await apiRequest(
        "/battles",
        {
          method: "POST",
          body: JSON.stringify({
            title: formData.title,
            category: formData.category,
            options: [
              {
                title: formData.entry_A.title,
                description: formData.entry_A.description,
                imageUrl: formData.entry_A.image_url,
                author: formData.entry_A.author || "Anonymous",
              },
              {
                title: formData.entry_B.title,
                description: formData.entry_B.description,
                imageUrl: formData.entry_B.image_url,
                author: formData.entry_B.author || "Anonymous",
              },
            ],
            endsAt: new Date(formData.endTime).toISOString(),
          }),
        },
        true,
      );
      if (!payload.data?.id) {
        throw new Error("The server returned an invalid battle response");
      }
      navigate(`/battles/${payload.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#09090B] text-white overflow-hidden">
      <div
        className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? "w-[78px]" : "w-[240px]"}`}
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 min-w-0 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <button
            onClick={() => navigate("/battles")}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-400 mb-8 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Battles
          </button>

          <h1 className="text-4xl font-black mb-2">
            Create a New Skill Battle
          </h1>
          <p className="text-slate-400 mb-8">
            Challenge the community. Two entries. One winner.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-8">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Battle Title */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <label className="block text-sm font-semibold mb-3">
                Battle Title
              </label>
              <input
                type="text"
                name="title"
                placeholder="e.g., UI Showdown: Dashboard vs App Kit"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Category & End Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <label className="block text-sm font-semibold mb-3">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <label className="block text-sm font-semibold mb-3">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) =>
                    handleInputChange({
                      target: { name: "endTime", value: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Entry A */}
            <div className="bg-gradient-to-br from-blue-900/20 to-blue-950/20 rounded-lg p-8 border border-blue-700 border-opacity-30">
              <h2 className="text-2xl font-bold mb-6">Entry A</h2>

              {/* Image Upload */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">
                  Image
                </label>
                {formData.entry_A.image_url ? (
                  <div className="relative w-full h-64 rounded-lg overflow-hidden border border-slate-700 mb-3">
                    <img
                      src={formData.entry_A.image_url}
                      alt="Entry A"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleEntryChange("entry_A", "image_url", "")
                      }
                      className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 p-2 rounded-lg transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-600 rounded-lg p-6 cursor-pointer hover:border-blue-500 transition-colors">
                    <Upload size={20} />
                    <span>Click to upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "entry_A")}
                      disabled={imageLoading.entry_A}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Entry title"
                  value={formData.entry_A.title}
                  onChange={(e) =>
                    handleEntryChange("entry_A", "title", e.target.value)
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Describe this entry..."
                  value={formData.entry_A.description}
                  onChange={(e) =>
                    handleEntryChange("entry_A", "description", e.target.value)
                  }
                  rows="3"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Author/Credit
                </label>
                <input
                  type="text"
                  placeholder="Author name (optional)"
                  value={formData.entry_A.author}
                  onChange={(e) =>
                    handleEntryChange("entry_A", "author", e.target.value)
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Entry B */}
            <div className="bg-gradient-to-br from-purple-900/20 to-purple-950/20 rounded-lg p-8 border border-purple-700 border-opacity-30">
              <h2 className="text-2xl font-bold mb-6">Entry B</h2>

              {/* Image Upload */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-3">
                  Image
                </label>
                {formData.entry_B.image_url ? (
                  <div className="relative w-full h-64 rounded-lg overflow-hidden border border-slate-700 mb-3">
                    <img
                      src={formData.entry_B.image_url}
                      alt="Entry B"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleEntryChange("entry_B", "image_url", "")
                      }
                      className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 p-2 rounded-lg transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-600 rounded-lg p-6 cursor-pointer hover:border-purple-500 transition-colors">
                    <Upload size={20} />
                    <span>Click to upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "entry_B")}
                      disabled={imageLoading.entry_B}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Entry title"
                  value={formData.entry_B.title}
                  onChange={(e) =>
                    handleEntryChange("entry_B", "title", e.target.value)
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Describe this entry..."
                  value={formData.entry_B.description}
                  onChange={(e) =>
                    handleEntryChange("entry_B", "description", e.target.value)
                  }
                  rows="3"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Author/Credit
                </label>
                <input
                  type="text"
                  placeholder="Author name (optional)"
                  value={formData.entry_B.author}
                  onChange={(e) =>
                    handleEntryChange("entry_B", "author", e.target.value)
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-4 rounded-lg transition-all text-lg"
            >
              {loading ? "Creating Battle..." : "Create Battle"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default CreateBattle;
