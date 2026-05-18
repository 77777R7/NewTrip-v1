#if UNITY_EDITOR
using NewTrip.Client.Road;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NewTrip.Client.Editor
{
    public static class RoadPrototypeSceneBuilder
    {
        private const string ScenePath = "Assets/NewTrip/Scenes/RoadPrototype.unity";
        private const string ImportedPreviewScenePath = "Assets/NewTrip/Scenes/RoadPrototypeImportedPreview.unity";

        [MenuItem("NewTrip/Road Prototype/Create Or Refresh Scene")]
        public static void CreateOrRefreshScene()
        {
            CreateScene(
                ScenePath,
                RoadPrototypeVisualMode.PlaceholderOnly,
                enableImportedLayers: false,
                "Created placeholder RoadPrototype scene. Press Play to validate road/camera/car anchors before enabling imported assets."
            );
        }

        [MenuItem("NewTrip/Road Prototype/Create Imported Assets Preview Scene")]
        public static void CreateImportedAssetsPreviewScene()
        {
            CreateScene(
                ImportedPreviewScenePath,
                RoadPrototypeVisualMode.ImportedPrototypeAssets,
                enableImportedLayers: true,
                "Created imported-assets RoadPrototype scene. Use this only after the placeholder pass is visually sane."
            );
        }

        private static void CreateScene(string scenePath, RoadPrototypeVisualMode visualMode, bool enableImportedLayers, string logMessage)
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before creating or refreshing the RoadPrototype scene.");
                return;
            }

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            SceneManager.SetActiveScene(scene);
            GameObject bootstrapObject = new GameObject("RoadPrototypeBootstrap");
            RoadPrototypeBootstrap bootstrap = bootstrapObject.AddComponent<RoadPrototypeBootstrap>();
            bootstrap.visualMode = visualMode;
            bootstrap.activeSegment = RoadVisualSegmentKey.CoastalCliffsSunset;
            bootstrap.projectionPreset = RoadProjectionPreset.BigSurPrototype;
            bootstrap.showDebugOverlay = true;
            bootstrap.enableFarBackgroundLayer = enableImportedLayers;
            bootstrap.enableRoadsideSpawner = true;
            bootstrap.enableSignSpawner = enableImportedLayers;
            bootstrap.enableWeatherOverlay = enableImportedLayers;

            Camera camera = new GameObject("Main Camera").AddComponent<Camera>();
            camera.gameObject.tag = "MainCamera";
            camera.transform.position = new Vector3(0f, 0f, -10f);
            camera.orthographic = true;
            camera.orthographicSize = 5f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.98f, 0.62f, 0.36f);

            EditorSceneManager.SaveScene(scene, scenePath);
            EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);
            Selection.activeGameObject = FindBootstrapInActiveScene()?.gameObject;
            Debug.Log(logMessage);
        }

        [MenuItem("NewTrip/Road Prototype/Rebuild Runtime Preview In Current Scene")]
        public static void RebuildRuntimePreview()
        {
            RoadPrototypeBootstrap bootstrap = FindBootstrapInActiveScene();

            if (bootstrap == null)
            {
                GameObject bootstrapObject = new GameObject("RoadPrototypeBootstrap");
                bootstrap = bootstrapObject.AddComponent<RoadPrototypeBootstrap>();
            }

            bootstrap.BuildPrototype();
            Selection.activeGameObject = bootstrap.gameObject;
            Debug.Log("Rebuilt the unsaved runtime preview. Use Play mode for the authoritative prototype check.");
        }

        private static RoadPrototypeBootstrap FindBootstrapInActiveScene()
        {
            Scene activeScene = SceneManager.GetActiveScene();

            if (!activeScene.IsValid())
            {
                return null;
            }

            GameObject[] roots = activeScene.GetRootGameObjects();

            for (int i = 0; i < roots.Length; i++)
            {
                RoadPrototypeBootstrap bootstrap = roots[i].GetComponentInChildren<RoadPrototypeBootstrap>(includeInactive: true);

                if (bootstrap != null)
                {
                    return bootstrap;
                }
            }

            return null;
        }
    }
}
#endif
