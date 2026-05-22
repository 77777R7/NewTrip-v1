using UnityEngine;

namespace NewTrip.Client.Road
{
    public static class PixelArtMaterialUtility
    {
        public const float RuntimeSpritePixelsPerUnit = 256f;
        public const string TransparentShaderName = "NewTrip/PixelUnlitTransparent";
        public const string OpaqueRoadShaderName = "NewTrip/RoadOpaqueVertexColor";
        private static Material sharedTransparentSpriteMaterial;

        public static Shader FindTransparentShader()
        {
            return Shader.Find(TransparentShaderName)
                ?? Shader.Find("Unlit/Transparent");
        }

        public static Shader FindOpaqueRoadShader()
        {
            return Shader.Find(OpaqueRoadShaderName)
                ?? Shader.Find("Unlit/Texture");
        }

        public static Material CreateTransparentMaterial(string materialName, Texture texture = null, int renderQueue = 3000)
        {
            ApplyPixelTextureSettings(texture, texture != null ? texture.wrapMode : TextureWrapMode.Clamp);

            Material material = new Material(FindTransparentShader())
            {
                name = materialName,
                mainTexture = texture
            };
            material.SetColor("_Color", Color.white);
            material.SetInt("_Cull", (int)UnityEngine.Rendering.CullMode.Off);
            material.renderQueue = renderQueue;
            return material;
        }

        public static Material GetSharedTransparentSpriteMaterial()
        {
            if (sharedTransparentSpriteMaterial != null)
            {
                return sharedTransparentSpriteMaterial;
            }

            sharedTransparentSpriteMaterial = CreateTransparentMaterial("NewTrip_SharedPixelUnlitTransparent");
            sharedTransparentSpriteMaterial.hideFlags = HideFlags.DontSaveInEditor | HideFlags.DontSaveInBuild;
            return sharedTransparentSpriteMaterial;
        }

        public static void ApplyPixelUnlit(SpriteRenderer renderer)
        {
            if (renderer == null)
            {
                return;
            }

            renderer.sharedMaterial = GetSharedTransparentSpriteMaterial();

            if (renderer.sprite != null)
            {
                ApplyPixelTextureSettings(renderer.sprite.texture, TextureWrapMode.Clamp);
            }
        }

        public static void ApplyPixelTextureSettings(Texture texture, TextureWrapMode wrapMode)
        {
            if (texture == null)
            {
                return;
            }

            texture.filterMode = FilterMode.Point;
            texture.wrapMode = wrapMode;
        }

        public static Material CreateOpaqueRoadMaterial(string materialName, Texture texture, float warmBounce = 0.32f)
        {
            ApplyPixelTextureSettings(texture, TextureWrapMode.Repeat);

            Material material = new Material(FindOpaqueRoadShader())
            {
                name = materialName,
                mainTexture = texture
            };
            material.SetColor("_Color", Color.white);
            material.SetFloat("_WarmBounce", warmBounce);
            material.SetFloat("_HorizonWashStrength", 1f);
            material.SetInt("_Cull", (int)UnityEngine.Rendering.CullMode.Off);
            material.renderQueue = 3000;
            return material;
        }
    }
}
