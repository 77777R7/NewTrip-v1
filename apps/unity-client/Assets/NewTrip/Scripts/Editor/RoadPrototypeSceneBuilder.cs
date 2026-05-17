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

        [MenuItem("NewTrip/Road Prototype/Create Or Refresh Scene")]
        public static void CreateOrRefreshScene()
        {
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            GameObject bootstrapObject = new GameObject("RoadPrototypeBootstrap");
            bootstrapObject.AddComponent<RoadPrototypeBootstrap>();

            Camera camera = new GameObject("Main Camera").AddComponent<Camera>();
            camera.gameObject.tag = "MainCamera";
            camera.transform.position = new Vector3(0f, 0f, -10f);
            camera.orthographic = true;
            camera.orthographicSize = 5f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.98f, 0.62f, 0.36f);

            EditorSceneManager.SaveScene(scene, ScenePath);
            Selection.activeGameObject = bootstrapObject;
            Debug.Log("Created RoadPrototype scene. Press Play to let RoadPrototypeBootstrap build the procedural road preview.");
        }

        [MenuItem("NewTrip/Road Prototype/Rebuild Runtime Preview In Current Scene")]
        public static void RebuildRuntimePreview()
        {
            RoadPrototypeBootstrap bootstrap = Object.FindObjectOfType<RoadPrototypeBootstrap>();

            if (bootstrap == null)
            {
                GameObject bootstrapObject = new GameObject("RoadPrototypeBootstrap");
                bootstrap = bootstrapObject.AddComponent<RoadPrototypeBootstrap>();
            }

            bootstrap.BuildPrototype();
            Selection.activeGameObject = bootstrap.gameObject;
            Debug.Log("Rebuilt the unsaved runtime preview. Use Play mode for the authoritative prototype check.");
        }
    }
}
#endif
