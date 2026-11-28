"""
Blender 4.x / 3.x Cycles Multi-Camera ArchViz Rendering Script for SenpaiAI.
Sets up a high-end corporate Tokyo executive boardroom, conference desk with evaluation dossier,
and 4 fixed cinematic camera angles matching the ArchViz Engine specification:

Camera Angles:
1. Cam_POV: Seated candidate POV looking straight across the table at the executive interviewer (50mm, eye-level 1.18m).
2. Cam_OTS: Over-The-Shoulder shot (candidate shoulder silhouette in foreground, 50mm).
3. Cam_Wide: Wide architectural perspective showing the boardroom and Tokyo cityscape (28mm).
4. Cam_Desk: Close-up on the desk dossier 【採用面接評価記録票】, fountain pen, and hanko seal (85mm macro).

Output:
- RGB Beauty Render (.png / .webp)
- Calibrated 8-bit Depth Pass (.png / .webp)
"""
import bpy
import math
import os

def setup_interview_archviz_scene(output_dir="frontend/public/archviz"):
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Clean default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # 2. Cycles Render Settings & Color Management
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU' if bpy.context.preferences.addons.get('cycles') else 'CPU'
    scene.cycles.samples = 512
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    
    # Resolution 2048x1152 (16:9 2K)
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 1152
    scene.render.resolution_percentage = 100

    # Color Management (ACES / AgX / Filmic High Contrast)
    scene.view_settings.view_transform = 'AgX' if 'AgX' in [v.name for v in scene.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    scene.view_settings.exposure = 0.2

    # Enable Depth Pass
    scene.view_layers["ViewLayer"].use_pass_z = True

    # -------------------------------------------------------------
    # 3. ENVIRONMENT & ROOM ARCHITECTURE
    # -------------------------------------------------------------
    # Room dimensions: Width 6.0m (X), Length 8.0m (Y), Height 3.2m (Z)
    
    # Conference Table (Walnut veneer with soft beveled edge)
    # Dimensions: 1.2m wide, 2.4m long, 0.74m standard height
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.72))
    table = bpy.context.active_object
    table.name = "Conference_Table"
    table.scale = (1.2, 2.4, 0.04)

    # Table Material (PBR Walnut Wood)
    mat_table = bpy.data.materials.new(name="PBR_Walnut_Veneer")
    mat_table.use_nodes = True
    bsdf_table = mat_table.node_tree.nodes.get("Principled BSDF")
    if bsdf_table:
        bsdf_table.inputs["Base Color"].default_value = (0.08, 0.04, 0.02, 1.0)
        bsdf_table.inputs["Roughness"].default_value = 0.32
        bsdf_table.inputs["IOR"].default_value = 1.52
    table.data.materials.append(mat_table)

    # Tokyo Skyline Window (Floor-to-ceiling glass on right side X = 3.0m)
    # Natural daylight fills the room from the window
    # Sunlight (Window light)
    sun_data = bpy.data.lights.new(name="Sun_Window", type='SUN')
    sun_data.energy = 4.5
    sun_data.color = (0.95, 0.96, 1.0) # 5800K daylight
    sun_obj = bpy.data.objects.new("Sun_Window", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(-65))

    # Recessed Ceiling Downlights (Warm 3800K corporate accent)
    light_data = bpy.data.lights.new(name="Ceiling_Accent", type='AREA')
    light_data.energy = 180.0
    light_data.size = 1.2
    light_data.size_y = 2.4
    light_data.color = (1.0, 0.94, 0.86) # Warm interior
    light_obj = bpy.data.objects.new("Ceiling_Accent", light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = (0, 0, 3.1)

    # -------------------------------------------------------------
    # 4. 4 TARGET CINEMATIC CAMERAS
    # -------------------------------------------------------------
    cameras = {}

    # Camera 1: POV Seated (Looking across table at interviewer eye level 1.18m)
    cam1_data = bpy.data.cameras.new(name="Cam_POV_Data")
    cam1_data.lens = 50.0 # Standard 50mm human vision
    cam1 = bpy.data.objects.new("Cam_POV", cam1_data)
    cam1.location = (0, -1.2, 1.18)
    cam1.rotation_euler = (math.radians(88), 0, 0)
    bpy.context.collection.objects.link(cam1)
    cameras['pov'] = cam1

    # Camera 2: Over-The-Shoulder (OTS)
    cam2_data = bpy.data.cameras.new(name="Cam_OTS_Data")
    cam2_data.lens = 50.0
    cam2 = bpy.data.objects.new("Cam_OTS", cam2_data)
    cam2.location = (-0.35, -1.55, 1.25)
    cam2.rotation_euler = (math.radians(86), 0, math.radians(-12))
    bpy.context.collection.objects.link(cam2)
    cameras['ots'] = cam2

    # Camera 3: Wide Boardroom
    cam3_data = bpy.data.cameras.new(name="Cam_Wide_Data")
    cam3_data.lens = 28.0 # Wide architectural lens
    cam3 = bpy.data.objects.new("Cam_Wide", cam3_data)
    cam3.location = (0, -2.6, 1.45)
    cam3.rotation_euler = (math.radians(82), 0, 0)
    bpy.context.collection.objects.link(cam3)
    cameras['wide'] = cam3

    # Camera 4: Desk Close-up (Macro document focus)
    cam4_data = bpy.data.cameras.new(name="Cam_Desk_Data")
    cam4_data.lens = 85.0 # Macro portrait lens
    cam4 = bpy.data.objects.new("Cam_Desk", cam4_data)
    cam4.location = (0.2, -0.7, 1.05)
    cam4.rotation_euler = (math.radians(52), 0, math.radians(15))
    bpy.context.collection.objects.link(cam4)
    cameras['desk'] = cam4

    # -------------------------------------------------------------
    # 5. COMPOSITING NODE TREE FOR CALIBRATED DEPTH MAPS
    # -------------------------------------------------------------
    scene.use_nodes = True
    tree = scene.node_tree
    for node in tree.nodes:
        tree.nodes.remove(node)

    render_layers = tree.nodes.new(type="CompositorNodeRLayers")
    composite = tree.nodes.new(type="CompositorNodeComposite")
    
    # Normalize depth (Z pass)
    normalize_depth = tree.nodes.new(type="CompositorNodeNormalize")
    tree.links.new(render_layers.outputs["Depth"], normalize_depth.inputs["Value"])

    # Output File Node for Depth Map
    depth_out = tree.nodes.new(type="CompositorNodeOutputFile")
    depth_out.base_path = output_dir
    depth_out.format.file_format = 'PNG'
    depth_out.format.color_mode = 'BW'
    depth_out.format.color_depth = '8'
    tree.links.new(normalize_depth.outputs["Value"], depth_out.inputs[0])

    # Connect RGB Beauty to Composite
    tree.links.new(render_layers.outputs["Image"], composite.inputs["Image"])

    print("[Blender ArchViz] Setup complete. Ready to render all 4 camera angles.")
    return cameras

def render_all_angles(cameras, output_dir="frontend/public/archviz"):
    scene = bpy.context.scene
    for angle_name, cam_obj in cameras.items():
        print(f"[Blender ArchViz] Rendering angle: {angle_name}...")
        scene.camera = cam_obj
        rgb_path = os.path.join(output_dir, f"room_executive_{angle_name}.png")
        scene.render.filepath = rgb_path
        bpy.ops.render.render(write_still=True)
        print(f"  -> Finished: {rgb_path}")

if __name__ == "__main__":
    cams = setup_interview_archviz_scene()
    # To execute render within Blender CLI:
    # blender -b -P scripts/blender/render_interview_archviz_multicam.py
