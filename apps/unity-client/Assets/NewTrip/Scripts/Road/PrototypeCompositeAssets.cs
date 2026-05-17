using UnityEngine;

namespace NewTrip.Client.Road
{
    public static class PrototypeCompositeAssets
    {
        private const string ResourceRoot = "PrototypeComposite/";

        public static Sprite LoadSprite(
            string assetName,
            Texture2D fallbackTexture,
            float pixelsPerUnit,
            TextureWrapMode wrapMode = TextureWrapMode.Clamp,
            Vector2? pivot = null
        )
        {
            Texture2D texture = LoadTexture(assetName, fallbackTexture, wrapMode);
            Sprite sprite = Sprite.Create(
                texture,
                new Rect(0f, 0f, texture.width, texture.height),
                pivot ?? new Vector2(0.5f, 0.5f),
                pixelsPerUnit
            );
            sprite.name = assetName;
            ApplyHideFlags(sprite);
            return sprite;
        }

        public static Texture2D LoadTexture(string assetName, Texture2D fallbackTexture, TextureWrapMode wrapMode)
        {
            Texture2D texture = Resources.Load<Texture2D>(ResourceRoot + assetName);

            if (texture == null)
            {
                texture = fallbackTexture;
            }

            texture.filterMode = FilterMode.Point;
            texture.wrapMode = wrapMode;
            return texture;
        }

        private static void ApplyHideFlags(Object target)
        {
            if (target != null && !Application.isPlaying)
            {
                target.hideFlags = HideFlags.DontSaveInEditor;
            }
        }
    }
}
