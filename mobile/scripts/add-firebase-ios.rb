require 'xcodeproj'

project_path = File.expand_path('../ios/App/App.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |item| item.name == 'App' }
raise 'App target not found' unless target
app_group = project.main_group.find_subpath('App', false) || project.main_group
file_ref = app_group.files.find { |file| file.path == 'GoogleService-Info.plist' }
file_ref ||= app_group.new_file('GoogleService-Info.plist')
unless target.resources_build_phase.files_references.include?(file_ref)
  target.resources_build_phase.add_file_reference(file_ref)
end
project.save
puts 'GoogleService-Info.plist added to the App target.'
