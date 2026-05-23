#if UNITY_EDITOR
using System.IO;
using System.Text;
using NewTrip.Client.Road;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NewTrip.Client.Editor
{
    public static class RoadPerspectiveReviewSceneBuilder
    {
        private const string ScenePath = "Assets/NewTrip/Scenes/RoadPerspectiveReview.unity";
        private const string CarAnchorScenePath = "Assets/NewTrip/Scenes/CarAnchorTest.unity";
        private const string OutputFolder = "Artifacts/RoadPerspectiveReview";
        private const string ReportFileName = "road_perspective_review_report.md";
        private const string CaptureRequestPath = "Temp/newtrip-road-perspective-capture.request";
        private const string CaptureLogPath = "Temp/newtrip-road-perspective-capture.log";
        private const int CaptureWidth = 1080;
        private const int CaptureHeight = 1920;
        private const float CruiseSpeedKmph = 72f;
        private const float ReviewSeconds = 10f;

        private static readonly PerspectiveCandidate[] Candidates =
        {
            new PerspectiveCandidate(
                "a_current_baseline",
                "A. Previous Gemini Baseline",
                RoadProjectionPreset.GeminiLowCamera,
                "Historical pre-selection projection. Used only as the control frame."
            ),
            new PerspectiveCandidate(
                "b_reference_gentle_road",
                "B. Reference Gentle Road",
                RoadProjectionPreset.ReferenceGentleRoad,
                "Most likely candidate: less upward ramp, smaller road-tip platform, still enough depth."
            ),
            new PerspectiveCandidate(
                "c_long_coast_road",
                "C. Long Coast Road",
                RoadProjectionPreset.LongCoastRoad,
                "Flatter, longer-feeling coastal road comparison. May trade away some speed pressure."
            )
        };

        [InitializeOnLoadMethod]
        private static void RunRequestedRoadPerspectiveCapture()
        {
            if (!File.Exists(CaptureRequestPath))
            {
                return;
            }

            File.Delete(CaptureRequestPath);
            File.AppendAllText(CaptureLogPath, "RoadPerspectiveReview capture requested.\n");
            EditorApplication.delayCall += RunRoadPerspectiveCaptureWhenReady;
        }

        private static void RunRoadPerspectiveCaptureWhenReady()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                File.AppendAllText(CaptureLogPath, "Waiting for Unity to leave Play Mode.\n");
                EditorApplication.isPlaying = false;
                EditorApplication.delayCall += RunRoadPerspectiveCaptureWhenReady;
                return;
            }

            File.AppendAllText(CaptureLogPath, "Running RoadPerspectiveReview capture.\n");
            CaptureRoadPerspectiveReviewPass();
            File.AppendAllText(CaptureLogPath, "RoadPerspectiveReview capture finished.\n");
        }

        [MenuItem("NewTrip/Road Prototype/Create RoadPerspectiveReview Scene")]
        public static void CreateRoadPerspectiveReviewScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before creating RoadPerspectiveReview.");
                return;
            }

            CarAnchorTestSceneBuilder.CreateCarAnchorTestScene();
            Scene scene = EditorSceneManager.OpenScene(CarAnchorScenePath, OpenSceneMode.Single);
            SceneManager.SetActiveScene(scene);

            if (!TryGetReviewObjects(out ReviewObjects reviewObjects))
            {
                Debug.LogError("RoadPerspectiveReview scene creation failed. Expected the Step 6B car-anchor road stack.");
                return;
            }

            ApplyCandidate(Candidates[1], reviewObjects, visualDistanceMeters: 0f, reviewTimeSeconds: 0f);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            Selection.activeGameObject = GameObject.Find("RoadMesh");
            Debug.Log("Created RoadPerspectiveReview scene with candidate B preview: " + ScenePath);
        }

        [MenuItem("NewTrip/Road Prototype/Capture Road Perspective Review Pass")]
        public static void CaptureRoadPerspectiveReviewPass()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before capturing Road Perspective Review Pass.");
                return;
            }

            CreateRoadPerspectiveReviewScene();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            if (!TryGetReviewObjects(out ReviewObjects reviewObjects))
            {
                Debug.LogError("RoadPerspectiveReview capture failed. Expected camera, motion state, road, lines, haze, and car.");
                return;
            }

            string outputPath = GetOutputPath();
            Directory.CreateDirectory(outputPath);
            StringBuilder report = BuildReportHeader();

            foreach (PerspectiveCandidate candidate in Candidates)
            {
                CaptureCandidate(candidate, reviewObjects, outputPath, report);
            }

            File.WriteAllText(GetReportPath(), report.ToString());
            AssetDatabase.Refresh();
            Debug.Log("Captured Road Perspective Review Pass to: " + outputPath);
        }

        private static void CaptureCandidate(PerspectiveCandidate candidate, ReviewObjects reviewObjects, string outputPath, StringBuilder report)
        {
            ApplyCandidate(candidate, reviewObjects, visualDistanceMeters: 0f, reviewTimeSeconds: 0f);
            Texture2D still = RenderCamera(reviewObjects.Camera);
            string stillName = "road_perspective_" + candidate.FileToken + "_still.png";
            WritePng(still, outputPath, stillName);

            float motionDistance = reviewObjects.MotionState.VisualSpeedMetersPerSecond * ReviewSeconds;
            ApplyCandidate(candidate, reviewObjects, motionDistance, ReviewSeconds);
            Texture2D motion = RenderCamera(reviewObjects.Camera);
            string motionName = "road_perspective_" + candidate.FileToken + "_10s_motion.png";
            WritePng(motion, outputPath, motionName);

            ApplyCandidate(candidate, reviewObjects, visualDistanceMeters: 0f, reviewTimeSeconds: 0f);
            string horizonName = "road_perspective_" + candidate.FileToken + "_horizon_closeup.png";
            string nearName = "road_perspective_" + candidate.FileToken + "_near_road_closeup.png";
            RenderCropToPng(reviewObjects.Camera, outputPath, horizonName, new RectInt(300, 800, 480, 380));
            RenderCropToPng(reviewObjects.Camera, outputPath, nearName, new RectInt(120, 0, 840, 620));

            RoadProjectionSettings settings = new RoadProjectionSettings();
            settings.ApplyPreset(candidate.Preset);
            report.Append("| ");
            report.Append(candidate.Label);
            report.Append(" | `");
            report.Append(candidate.Preset);
            report.Append("` | ");
            report.Append(settings.horizonY.ToString("0.000"));
            report.Append(" | ");
            report.Append(settings.bottomY.ToString("0.000"));
            report.Append(" | ");
            report.Append(settings.nearHalfWidth.ToString("0.000"));
            report.Append(" | ");
            report.Append(settings.horizonHalfWidth.ToString("0.000"));
            report.Append(" | ");
            report.Append(settings.depthCurve.ToString("0.00"));
            report.Append(" | ");
            report.Append(stillName);
            report.Append(", ");
            report.Append(motionName);
            report.Append(" | ");
            report.Append(candidate.Notes);
            report.AppendLine(" |");

            Object.DestroyImmediate(still);
            Object.DestroyImmediate(motion);
        }

        private static void ApplyCandidate(PerspectiveCandidate candidate, ReviewObjects reviewObjects, float visualDistanceMeters, float reviewTimeSeconds)
        {
            reviewObjects.MotionState.SetReviewSpeedKmph(CruiseSpeedKmph);
            reviewObjects.MotionState.SetVisualDistanceForReview(visualDistanceMeters);

            ApplyProjectionPreset(reviewObjects.RoadRenderer, candidate.Preset);
            ApplyProjectionPreset(reviewObjects.CrackRenderer, candidate.Preset);
            RebuildLines(reviewObjects);
            AlignHorizonLayers(reviewObjects.RoadRenderer.projection.horizonY, reviewObjects);
            EvaluateCar(reviewObjects, reviewTimeSeconds);
            RefreshMotion(reviewObjects);
        }

        private static void ApplyProjectionPreset(Pseudo3DRoadRenderer renderer, RoadProjectionPreset preset)
        {
            if (renderer == null)
            {
                return;
            }

            renderer.projectionPreset = preset;
            renderer.applyProjectionPresetOnRebuild = true;
            renderer.ApplyProjectionPreset();
        }

        private static void RebuildLines(ReviewObjects reviewObjects)
        {
            foreach (LaneMarkingRenderer renderer in reviewObjects.LineRenderers)
            {
                if (renderer != null)
                {
                    renderer.RebuildMesh();
                }
            }
        }

        private static void RefreshMotion(ReviewObjects reviewObjects)
        {
            foreach (Pseudo3DRoadRenderer renderer in reviewObjects.RoadRenderers)
            {
                if (renderer != null)
                {
                    renderer.RefreshMotionForReview();
                }
            }

            foreach (LaneMarkingRenderer renderer in reviewObjects.LineRenderers)
            {
                if (renderer != null)
                {
                    renderer.RefreshMotionForReview();
                }
            }
        }

        private static void AlignHorizonLayers(float roadHorizonViewportY, ReviewObjects reviewObjects)
        {
            if (reviewObjects.FarBackgroundLayer != null)
            {
                Vector3 position = reviewObjects.FarBackgroundLayer.transform.position;
                position.y = ViewportYToWorld(roadHorizonViewportY);
                reviewObjects.FarBackgroundLayer.transform.position = position;
            }

            if (reviewObjects.HorizonHazeController != null)
            {
                reviewObjects.HorizonHazeController.hazePositionY = Mathf.Clamp01(roadHorizonViewportY + 0.02f);
                reviewObjects.HorizonHazeController.Apply();
            }
        }

        private static void EvaluateCar(ReviewObjects reviewObjects, float reviewTimeSeconds)
        {
            if (reviewObjects.CarController == null)
            {
                return;
            }

            reviewObjects.CarController.ResetBaseShadowState();
            reviewObjects.CarController.EvaluateForReview(reviewTimeSeconds, reviewObjects.MotionState.VisualSpeedNorm);
        }

        private static bool TryGetReviewObjects(out ReviewObjects reviewObjects)
        {
            Camera camera = Camera.main;
            RoadMotionState motionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            Pseudo3DRoadRenderer crackRenderer = GameObject.Find("RoadCrackDetailMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            LaneMarkingRenderer leftYellow = GameObject.Find("LaneYellowLeftMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightYellow = GameObject.Find("LaneYellowRightMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer leftEdge = GameObject.Find("RoadEdgeLeftLine")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightEdge = GameObject.Find("RoadEdgeRightLine")?.GetComponent<LaneMarkingRenderer>();
            HorizonHazeLayerController hazeController = GameObject.Find("HorizonHazeLayer")?.GetComponent<HorizonHazeLayerController>();
            SpriteRenderer farLayer = GameObject.Find("FarBackgroundLayer")?.GetComponent<SpriteRenderer>();
            CarRearController carController = GameObject.Find("PlayerCarRoot")?.GetComponent<CarRearController>();

            reviewObjects = new ReviewObjects(
                camera,
                motionState,
                roadRenderer,
                crackRenderer,
                new[] { roadRenderer, crackRenderer },
                new[] { leftYellow, rightYellow, leftEdge, rightEdge },
                hazeController,
                farLayer,
                carController
            );

            return camera != null
                && motionState != null
                && roadRenderer != null
                && leftYellow != null
                && rightYellow != null
                && leftEdge != null
                && rightEdge != null
                && hazeController != null
                && farLayer != null
                && carController != null;
        }

        private static StringBuilder BuildReportHeader()
        {
            StringBuilder report = new StringBuilder();
            report.AppendLine("# Road Perspective Review Pass");
            report.AppendLine();
            report.AppendLine("Status: review-ready");
            report.AppendLine();
            report.AppendLine("Generated by `NewTrip/Road Prototype/Capture Road Perspective Review Pass`.");
            report.AppendLine();
            report.AppendLine("## Scope");
            report.AppendLine();
            report.AppendLine("- Projection parameters only.");
            report.AppendLine("- No material tuning, car edits, UI, props, bridge, weather, vegetation, or full-road imagery.");
            report.AppendLine("- The car sprite, road material, lane material, white edge lines, and shared `RoadMotionState` remain unchanged.");
            report.AppendLine("- Far background and horizon haze are temporarily re-anchored to each candidate road horizon so the projection comparison is fair.");
            report.AppendLine();
            report.AppendLine("## Candidates");
            report.AppendLine();
            report.AppendLine("| Candidate | Preset | road_horizon_y | bottom_y | near_half_width | horizon_half_width | depth_curve | Captures | Notes |");
            report.AppendLine("| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |");
            return report;
        }

        private static Texture2D RenderCamera(Camera camera)
        {
            RenderTexture renderTexture = new RenderTexture(CaptureWidth, CaptureHeight, 24, RenderTextureFormat.ARGB32)
            {
                filterMode = FilterMode.Point
            };
            Texture2D texture = new Texture2D(CaptureWidth, CaptureHeight, TextureFormat.RGBA32, mipChain: false)
            {
                filterMode = FilterMode.Point
            };

            RenderTexture previousActive = RenderTexture.active;
            RenderTexture previousTarget = camera.targetTexture;

            camera.targetTexture = renderTexture;
            RenderTexture.active = renderTexture;
            camera.Render();
            texture.ReadPixels(new Rect(0f, 0f, CaptureWidth, CaptureHeight), 0, 0);
            texture.Apply(updateMipmaps: false, makeNoLongerReadable: false);

            camera.targetTexture = previousTarget;
            RenderTexture.active = previousActive;
            renderTexture.Release();
            Object.DestroyImmediate(renderTexture);
            return texture;
        }

        private static void RenderCropToPng(Camera camera, string outputPath, string fileName, RectInt crop)
        {
            Texture2D source = RenderCamera(camera);
            RectInt clamped = ClampCrop(source, crop);
            Texture2D cropped = new Texture2D(clamped.width, clamped.height, TextureFormat.RGBA32, mipChain: false)
            {
                filterMode = FilterMode.Point
            };
            cropped.SetPixels(source.GetPixels(clamped.x, clamped.y, clamped.width, clamped.height));
            cropped.Apply(updateMipmaps: false, makeNoLongerReadable: false);
            WritePng(cropped, outputPath, fileName);
            Object.DestroyImmediate(cropped);
            Object.DestroyImmediate(source);
        }

        private static RectInt ClampCrop(Texture2D source, RectInt crop)
        {
            int x = Mathf.Clamp(crop.x, 0, source.width - 1);
            int y = Mathf.Clamp(crop.y, 0, source.height - 1);
            int width = Mathf.Clamp(crop.width, 1, source.width - x);
            int height = Mathf.Clamp(crop.height, 1, source.height - y);
            return new RectInt(x, y, width, height);
        }

        private static void WritePng(Texture2D texture, string outputPath, string fileName)
        {
            File.WriteAllBytes(Path.Combine(outputPath, fileName), texture.EncodeToPNG());
        }

        private static float ViewportYToWorld(float viewportY)
        {
            return (viewportY - 0.5f) * RoadViewportContract.WorldHeight;
        }

        private static string GetOutputPath()
        {
            DirectoryInfo projectRoot = Directory.GetParent(Application.dataPath);
            return Path.Combine(projectRoot.FullName, OutputFolder);
        }

        private static string GetReportPath()
        {
            return Path.Combine(GetOutputPath(), ReportFileName);
        }

        private readonly struct PerspectiveCandidate
        {
            public PerspectiveCandidate(string fileToken, string label, RoadProjectionPreset preset, string notes)
            {
                FileToken = fileToken;
                Label = label;
                Preset = preset;
                Notes = notes;
            }

            public string FileToken { get; }
            public string Label { get; }
            public RoadProjectionPreset Preset { get; }
            public string Notes { get; }
        }

        private readonly struct ReviewObjects
        {
            public ReviewObjects(
                Camera camera,
                RoadMotionState motionState,
                Pseudo3DRoadRenderer roadRenderer,
                Pseudo3DRoadRenderer crackRenderer,
                Pseudo3DRoadRenderer[] roadRenderers,
                LaneMarkingRenderer[] lineRenderers,
                HorizonHazeLayerController horizonHazeController,
                SpriteRenderer farBackgroundLayer,
                CarRearController carController
            )
            {
                Camera = camera;
                MotionState = motionState;
                RoadRenderer = roadRenderer;
                CrackRenderer = crackRenderer;
                RoadRenderers = roadRenderers;
                LineRenderers = lineRenderers;
                HorizonHazeController = horizonHazeController;
                FarBackgroundLayer = farBackgroundLayer;
                CarController = carController;
            }

            public Camera Camera { get; }
            public RoadMotionState MotionState { get; }
            public Pseudo3DRoadRenderer RoadRenderer { get; }
            public Pseudo3DRoadRenderer CrackRenderer { get; }
            public Pseudo3DRoadRenderer[] RoadRenderers { get; }
            public LaneMarkingRenderer[] LineRenderers { get; }
            public HorizonHazeLayerController HorizonHazeController { get; }
            public SpriteRenderer FarBackgroundLayer { get; }
            public CarRearController CarController { get; }
        }
    }
}
#endif
